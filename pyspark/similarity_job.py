#!/usr/bin/env python3
import argparse
from pyspark.ml.linalg import Vector
from pyspark.sql.types import DoubleType

from pyspark.sql import functions as F
from pyspark.sql import Window
from pyspark.sql.types import ArrayType
from pyspark import StorageLevel

from pyspark.ml import Pipeline
from pyspark.ml.feature import (
    RegexTokenizer,
    StopWordsRemover,
    HashingTF,
    IDF,
    Normalizer,
)
from pyspark.ml.feature import BucketedRandomProjectionLSH

# Spark session kai Mongo connector
# Δηλώνουμε read/write URIs ώστε ο Spark να μπορεί να διαβάζει/γράφει απευθείας στη MongoDB
# Αυτό επιτρέπει offline ML job που αποθηκεύει αποτελέσματα στη βάση (course_similarity)
def build_spark(app_name: str, mongo_uri: str):
    from pyspark.sql import SparkSession

    spark = (
        SparkSession.builder.appName(app_name)
        .config("spark.mongodb.read.connection.uri", mongo_uri)
        .config("spark.mongodb.write.connection.uri", mongo_uri)
        # local[*] tuning (docker)
        .config("spark.sql.shuffle.partitions", "64")
        .config("spark.default.parallelism", "64")
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.adaptive.coalescePartitions.enabled", "true")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    return spark

# Cosine similarity UDF.
# Επειδή τα feature vectors έχουν L2 normalization cosine(a,b) = dot(a,b)
@F.udf(DoubleType())
def cos_udf(a: Vector, b: Vector) -> float:
    if a is None or b is None:
        return None
    return float(a.dot(b))


def main():
    p = argparse.ArgumentParser()

    p.add_argument("--mongo-uri", required=True)
    p.add_argument("--db", required=True)
    p.add_argument("--in-collection", default="courses")
    p.add_argument("--out-collection", default="course_similarity")

    p.add_argument("--k", type=int, default=5)
    p.add_argument("--id-col", default="_id")

    # TF-IDF
    p.add_argument("--num-features", type=int, default=262144)
    p.add_argument("--min-text-len", type=int, default=80)

    # LSH
    p.add_argument("--bucket-length", type=float, default=3.0)
    p.add_argument("--num-hash-tables", type=int, default=2)

    # Blocking / safety knobs 
    p.add_argument("--bucket-cap", type=int, default=200,
                   help="Max courses kept per (language,bucket). Controls pair explosion.")
    p.add_argument("--min-cos", type=float, default=0.25,
                   help="Minimum cosine similarity to keep a candidate.")
    p.add_argument("--candidate-cap", type=int, default=80,
                   help="Max candidates per src before top-K.")

    # Debug
    p.add_argument("--limit", type=int, default=0)

    args = p.parse_args()
    spark = build_spark("course-similarity-job", args.mongo_uri)

    # Διαβαζει courses και δημιουργούμε course_id ως string
    courses = (
        spark.read.format("mongodb")
        .option("database", args.db)
        .option("collection", args.in_collection)
        .load()
    )

    if args.id_col not in courses.columns:
        raise ValueError(f"ID column '{args.id_col}' not found. Available: {courses.columns}")

    df = courses.withColumn("course_id", F.col(args.id_col).cast("string"))

    # text = shortDescription + keywords
    if "shortDescription" in df.columns:
        df = df.withColumn("short_desc", F.coalesce(F.col("shortDescription").cast("string"), F.lit("")))
    else:
        df = df.withColumn("short_desc", F.lit(""))

    if "keywords" in df.columns:
        kw_type = df.schema["keywords"].dataType
        if isinstance(kw_type, ArrayType):
            df = df.withColumn(
                "kw_text",
                F.when(F.col("keywords").isNull(), F.lit("")).otherwise(F.concat_ws(" ", F.col("keywords")))
            )
        else:
            df = df.withColumn("kw_text", F.coalesce(F.col("keywords").cast("string"), F.lit("")))
    else:
        df = df.withColumn("kw_text", F.lit(""))

    df = df.withColumn("text", F.trim(F.concat_ws(" ", F.col("short_desc"), F.col("kw_text"))))
    df = df.withColumn("text", F.regexp_replace(F.col("text"), r"\s+", " "))

    # Data cleaning
    #  απαιτούμε language για να συγκρίνουμε courses στην ίδια γλώσσα
    #  κρατάμε μόνο courses με αρκετό κείμενο (min_text_len)
    # αφαιρούμε duplicates
    if "language" not in df.columns:
        df = df.withColumn("language", F.lit(None).cast("string"))
    else:
        df = df.withColumn("language", F.lower(F.trim(F.col("language").cast("string"))))

    # filter
    df = df.select("course_id", "language", "text").dropna(subset=["course_id"])
    df = df.filter(F.col("language").isNotNull() & (F.length("language") > 0))
    df = df.filter(F.length("text") >= F.lit(args.min_text_len))
    df = df.dropDuplicates(["course_id"])

    if args.limit and args.limit > 0:
        df = df.orderBy(F.rand(seed=42)).limit(args.limit)

    print("Sample input rows:")
    df.show(5, truncate=90)

    # TF-IDF pipeline
    # NLP vectorization
    # Tokenize → remove stopwords → TF-IDF → L2 normalization
    # Φιλτράρουμε courses με <5 tokens για να αποφύγουμε θόρυβο
    tokenizer = RegexTokenizer(inputCol="text", outputCol="tokens", pattern=r"\W+", minTokenLength=2)

   # αφαιρεί κοινές λέξεις (κυρίως για EN βοηθά)
    remover = StopWordsRemover(inputCol="tokens", outputCol="filtered")

    hashing_tf = HashingTF(inputCol="filtered", outputCol="tf", numFeatures=args.num_features)
    idf = IDF(inputCol="tf", outputCol="tfidf")
    norm = Normalizer(inputCol="tfidf", outputCol="features", p=2.0)

    model = Pipeline(stages=[tokenizer, remover, hashing_tf, idf, norm]).fit(df)
    featurized = (
    model.transform(df)
    .select("course_id", "language", "filtered", "features")
    .filter(F.size("filtered") >= 5)
    .select("course_id", "language", "features")
)


    featurized = featurized.repartition(64, "language")

    # LSH hashing
    # δημιουργεί hashes/buckets για approximate neighbor search
    # Persist γιατί θα το ξαναχρησιμοποιήσουμε σε multiple downstream transformations

    lsh = BucketedRandomProjectionLSH(
        inputCol="features",
        outputCol="hashes",
        bucketLength=args.bucket_length,
        numHashTables=args.num_hash_tables,
    )
    lsh_model = lsh.fit(featurized)

    hashed = lsh_model.transform(featurized).select("course_id", "language", "features", "hashes") \
        .persist(StorageLevel.MEMORY_AND_DISK)

    # Blocking
    # explode hashes ώστε να πάρουμε explicit buckets
    # cap ανά language, bucket για να αποφύγουμε pair explosion

    buckets = (
        hashed
        .withColumn("h", F.explode("hashes"))
        .withColumn("bucket", F.col("h").cast("string"))
        .select("course_id", "language", "features", "bucket")
    )

    w_bucket = Window.partitionBy("language", "bucket").orderBy(F.asc("course_id"))
    buckets_capped = (
        buckets
        .withColumn("rn", F.row_number().over(w_bucket))
        .filter(F.col("rn") <= F.lit(args.bucket_cap))
        .drop("rn")
        .persist(StorageLevel.DISK_ONLY)
    )

    # Candidate pairs
    # Join μέσα στο ίδιο (language,bucket) 
    # κρατάμε μόνο src<dst ώστε να αποφύγουμε διπλά ζευγάρια
    a = buckets_capped.alias("a")
    b = buckets_capped.alias("b")

    cand = (
        a.join(
            b,
            on=[F.col("a.language") == F.col("b.language"), F.col("a.bucket") == F.col("b.bucket")],
            how="inner",
        )
        .select(
            F.col("a.course_id").alias("src"),
            F.col("b.course_id").alias("dst"),
            F.col("a.features").alias("fa"),
            F.col("b.features").alias("fb"),
        )
        .filter(F.col("src") < F.col("dst"))   
        .persist(StorageLevel.DISK_ONLY)
    )
    # Scoring
    # Υπολογίζουμε cosine similarity μόνο στους candidates και κρατάμε όσους περνούν το min_cos.
    scored = (
    cand
    .withColumn("cos", cos_udf(F.col("fa"), F.col("fb")))
    .filter(F.col("cos") >= F.lit(args.min_cos))
    .select("src", "dst", "cos")
)
    # το ίδιο pair μπορεί να εμφανιστεί σε πολλαπλά buckets αρα κρατάμε το max score
    scored = scored.groupBy("src", "dst").agg(F.max("cos").alias("score"))

    # κάνουμε expand σε 2 κατευθύνσεις ώστε κάθε course να έχει recommendations
    scored2 = (
        scored
        .select(F.col("src").alias("s"), F.col("dst").alias("d"), "score")
        .unionByName(scored.select(F.col("dst").alias("s"), F.col("src").alias("d"), "score"))
        .withColumnRenamed("s", "src")
        .withColumnRenamed("d", "dst")
        .persist(StorageLevel.DISK_ONLY)
    )

    # περιορίζουμε πόσους candidates κρατάμε ανά src πριν το τελικό top-K για σταθερή απόδοση
    w_cand = Window.partitionBy("src").orderBy(F.desc("score"), F.asc("dst"))
    scored2 = (
        scored2
        .withColumn("rn", F.row_number().over(w_cand))
        .filter(F.col("rn") <= F.lit(args.candidate_cap))
        .drop("rn")
    )

   # Top-K aggregation:
    # Για κάθε src course φτιάχνουμε arrays similar_ids και scores
    #  ώστε να αποθηκευτούν εύκολα στη Mongo
    w_topk = Window.partitionBy("src").orderBy(F.desc("score"), F.asc("dst"))
    topk = (
        scored2
        .withColumn("rn", F.row_number().over(w_topk))
        .filter(F.col("rn") <= F.lit(args.k))
        .drop("rn")
    )

    result = (
        topk.groupBy("src")
        .agg(F.collect_list(F.struct(F.col("score"), F.col("dst"))).alias("items"))
        .withColumn("items", F.expr("array_sort(items)"))
        .withColumn("items", F.expr("reverse(items)"))
        .withColumn("similar_ids", F.expr("transform(items, x -> x.dst)"))
        .withColumn("scores", F.expr("transform(items, x -> x.score)"))
        .drop("items")
        .withColumnRenamed("src", "courseId")
    )

    # καθε courseId εμφανίζεται στο output
    all_courses = hashed.select(F.col("course_id").alias("courseId")).distinct()
    result = (
        all_courses.join(result, on="courseId", how="left")
        .withColumn("similar_ids", F.coalesce(F.col("similar_ids"), F.array().cast("array<string>")))
        .withColumn("scores", F.coalesce(F.col("scores"), F.array().cast("array<double>")))
    )

    # Write to Mongo
    (
        result.write.format("mongodb")
        .mode("overwrite")
        .option("database", args.db)
        .option("collection", args.out_collection)
        .save()
    )

    print(f"Write completed to {args.db}.{args.out_collection}")
    spark.stop()

if __name__ == "__main__":
    main()
