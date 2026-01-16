#!/usr/bin/env python3
import argparse

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


def build_spark(app_name: str, mongo_uri: str):
    from pyspark.sql import SparkSession

    spark = (
        SparkSession.builder.appName(app_name)
        .config("spark.mongodb.read.connection.uri", mongo_uri)
        .config("spark.mongodb.write.connection.uri", mongo_uri)
        # sensible defaults for single-container runs
        .config("spark.sql.shuffle.partitions", "200")
        .config("spark.default.parallelism", "200")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    return spark


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("--mongo-uri", required=True, help="Mongo URI (e.g. mongodb://mongo:27017)")
    parser.add_argument("--db", required=True)
    parser.add_argument("--in-collection", default="courses")
    parser.add_argument("--out-collection", default="course_similarity")

    parser.add_argument("--k", type=int, default=5, help="Top-K recommendations per course")
    parser.add_argument("--id-col", default="_id", help="ID column in courses (e.g. _id or courseId)")

    # TF-IDF (HashingTF) controls
    parser.add_argument("--num-features", type=int, default=262144,  # 2^18
                        help="HashingTF feature dimension (bigger -> fewer collisions, more memory)")
    parser.add_argument("--min-text-len", type=int, default=30, help="Drop courses with shorter text")

    # LSH tuning
    parser.add_argument("--bucket-length", type=float, default=2.0)
    parser.add_argument("--num-hash-tables", type=int, default=4)
    parser.add_argument("--max-dist", type=float, default=1.2,
                        help="Euclidean threshold on L2-normalized vectors (smaller -> fewer pairs)")

    # Candidate control (crucial for large datasets)
    parser.add_argument("--candidate-cap", type=int, default=80,
                        help="Keep at most this many nearest candidates per src before top-K (memory safety)")

    # Optional debug / smoke test
    parser.add_argument("--limit", type=int, default=0,
                        help="If >0, limit number of courses for debug (e.g. 5000)")

    args = parser.parse_args()
    spark = build_spark("course-similarity-job", args.mongo_uri)

    # 1) Read courses
    courses = (
        spark.read.format("mongodb")
        .option("database", args.db)
        .option("collection", args.in_collection)
        .load()
    )

    if args.id_col not in courses.columns:
        raise ValueError(f"ID column '{args.id_col}' not found. Available: {courses.columns}")

    df = courses.withColumn("course_id", F.col(args.id_col).cast("string"))

    # 2) Build text = shortDescription + keywords
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

    # language (required for filtering)
    if "language" not in df.columns:
        df = df.withColumn("language", F.lit(None).cast("string"))
    else:
        df = df.withColumn("language", F.trim(F.col("language").cast("string")))

    # Keep only what we need, clean & filter
    df = df.select("course_id", "language", "text").dropna(subset=["course_id"])
    df = df.filter(F.col("language").isNotNull() & (F.length(F.col("language")) > 0))
    df = df.filter(F.length(F.col("text")) >= F.lit(args.min_text_len))
    df = df.dropDuplicates(["course_id"])

    if args.limit and args.limit > 0:
        df = df.limit(args.limit)

    # Light sanity output (doesn't scan full dataset in a costly way)
    print("✅ Sample input rows:")
    df.show(5, truncate=90)

    # 3) TF-IDF pipeline via HashingTF (memory safer than CountVectorizer)
    tokenizer = RegexTokenizer(inputCol="text", outputCol="tokens", pattern=r"\W+", minTokenLength=2)
    remover = StopWordsRemover(inputCol="tokens", outputCol="filtered")

    hashing_tf = HashingTF(inputCol="filtered", outputCol="tf", numFeatures=args.num_features)
    idf = IDF(inputCol="tf", outputCol="tfidf")
    norm = Normalizer(inputCol="tfidf", outputCol="features", p=2.0)

    pipeline = Pipeline(stages=[tokenizer, remover, hashing_tf, idf, norm])
    model = pipeline.fit(df)

    featurized = model.transform(df).select("course_id", "language", "features")

    # Partition by language helps reduce shuffle skew a bit
    featurized = featurized.repartition(200, "language")

    # 4) LSH similarity on normalized vectors
    lsh = BucketedRandomProjectionLSH(
        inputCol="features",
        outputCol="hashes",
        bucketLength=args.bucket_length,
        numHashTables=args.num_hash_tables,
    )
    lsh_model = lsh.fit(featurized)

    hashed = lsh_model.transform(featurized).select("course_id", "language", "features", "hashes") \
        .persist(StorageLevel.MEMORY_AND_DISK)

    # Important: approxSimilarityJoin output is datasetA/datasetB
    pairs = (
        lsh_model.approxSimilarityJoin(
            hashed, hashed, args.max_dist, distCol="dist"
        )
        .select(
            F.col("datasetA.course_id").alias("src"),
            F.col("datasetB.course_id").alias("dst"),
            F.col("datasetA.language").alias("src_lang"),
            F.col("datasetB.language").alias("dst_lang"),
            F.col("dist").alias("dist"),
        )
        .filter(F.col("src") != F.col("dst"))
        .filter(F.col("src_lang") == F.col("dst_lang"))  # language filter
        .select("src", "dst", "dist")
    ).persist(StorageLevel.MEMORY_AND_DISK)

    # Existence check: lightweight
    any_pair = pairs.limit(1).count()
    print(f"✅ Similarity pairs exist? {'YES' if any_pair > 0 else 'NO'}")
    if any_pair == 0:
        # Write empty schema for all courses (so backend doesn't break)
        empty_out = hashed.select(F.col("course_id").alias("courseId")).distinct() \
            .withColumn("similar_ids", F.array().cast("array<string>")) \
            .withColumn("scores", F.array().cast("array<double>"))

        (empty_out.write.format("mongodb")
         .mode("overwrite")
         .option("database", args.db)
         .option("collection", args.out_collection)
         .save())

        print(f"✅ Write completed (empty) to {args.db}.{args.out_collection}")
        spark.stop()
        return

    # Convert distance (unit vectors) -> cosine similarity: cosine = 1 - dist^2/2
    pairs = pairs.withColumn("score", (F.lit(1.0) - (F.col("dist") * F.col("dist")) / F.lit(2.0)))

    # Candidate cap per src (critical for large datasets)
    # Keep nearest candidates (smallest dist / highest score)
    w_cand = Window.partitionBy("src").orderBy(F.asc("dist"), F.asc("dst"))
    pairs_capped = (
        pairs.withColumn("rn", F.row_number().over(w_cand))
        .filter(F.col("rn") <= F.lit(args.candidate_cap))
        .drop("rn")
    )

    # Keep best per (src,dst)
    pairs_capped = pairs_capped.groupBy("src", "dst").agg(F.max("score").alias("score"))

    # 5) Top-K per course
    w_topk = Window.partitionBy("src").orderBy(F.desc("score"), F.asc("dst"))
    topk = (
        pairs_capped.withColumn("rn", F.row_number().over(w_topk))
        .filter(F.col("rn") <= F.lit(args.k))
        .drop("rn")
    )

    result = (
        topk.groupBy("src")
        .agg(
            F.collect_list("dst").alias("similar_ids"),
            F.collect_list("score").alias("scores"),
        )
        .withColumnRenamed("src", "courseId")
    )

    # Ensure every course appears (even if it ends up with empty arrays)
    all_courses = hashed.select(F.col("course_id").alias("courseId")).distinct()
    result = (
        all_courses.join(result, on="courseId", how="left")
        .withColumn("similar_ids", F.coalesce(F.col("similar_ids"), F.array().cast("array<string>")))
        .withColumn("scores", F.coalesce(F.col("scores"), F.array().cast("array<double>")))
    )

    # 6) Write to Mongo
    (
        result.write.format("mongodb")
        .mode("overwrite")
        .option("database", args.db)
        .option("collection", args.out_collection)
        .save()
    )

    print(f"✅ Write completed to {args.db}.{args.out_collection}")
    spark.stop()


if __name__ == "__main__":
    main()
