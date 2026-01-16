#!/usr/bin/env python3
import argparse

from pyspark.sql import functions as F
from pyspark.sql import Window
from pyspark.sql.types import ArrayType

from pyspark.ml import Pipeline
from pyspark.ml.feature import (
    RegexTokenizer,
    StopWordsRemover,
    CountVectorizer,
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

    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--id-col", default="_id", help="ID column in courses (e.g. _id or courseId)")

    # TF-IDF tuning
    parser.add_argument("--min-doc-freq", type=int, default=1)
    parser.add_argument("--vocab-size", type=int, default=50000)

    # LSH tuning
    parser.add_argument("--bucket-length", type=float, default=2.0)
    parser.add_argument("--num-hash-tables", type=int, default=5)
    parser.add_argument("--max-dist", type=float, default=2.5, help="Euclidean threshold on normalized vectors")

    # Optional debug
    parser.add_argument("--limit", type=int, default=0, help="If >0, limit courses for debug (e.g. 200)")

    args = parser.parse_args()
    spark = build_spark("course-similarity-job", args.mongo_uri)

    ID_COL = args.id_col

    # 1) Read courses
    courses = (
        spark.read.format("mongodb")
        .option("database", args.db)
        .option("collection", args.in_collection)
        .load()
    )

    if ID_COL not in courses.columns:
        raise ValueError(f"ID column '{ID_COL}' not found in input. Available columns: {courses.columns}")

    df = courses.withColumn("course_id", F.col(ID_COL).cast("string"))

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

    # Keep language for filtering
    if "language" not in df.columns:
        df = df.withColumn("language", F.lit(None).cast("string"))
    else:
        df = df.withColumn("language", F.col("language").cast("string"))

    # Basic cleaning
    df = df.select("course_id", "language", "text").dropna(subset=["course_id"])
    df = df.filter(F.length(F.col("text")) > 0)
    df = df.dropDuplicates(["course_id"])

    # Language filtering: we want only courses with a valid language
    df = df.filter(F.col("language").isNotNull() & (F.length(F.col("language")) > 0))

    if args.limit and args.limit > 0:
        df = df.limit(args.limit)

    courses_count = df.count()
    print(f"✅ Courses for ML (after text+language filters): {courses_count}")
    df.select("course_id", "language", "text").show(5, truncate=80)

    if courses_count < 2:
        print("⚠️ Not enough courses to compute similarity (need at least 2). Exiting.")
        spark.stop()
        return

    # 3) TF-IDF pipeline
    tokenizer = RegexTokenizer(inputCol="text", outputCol="tokens", pattern=r"\W+", minTokenLength=2)
    remover = StopWordsRemover(inputCol="tokens", outputCol="filtered")  # default English stopwords
    cv = CountVectorizer(
        inputCol="filtered",
        outputCol="tf",
        vocabSize=args.vocab_size,
        minDF=args.min_doc_freq,
    )
    idf = IDF(inputCol="tf", outputCol="tfidf")
    norm = Normalizer(inputCol="tfidf", outputCol="features", p=2.0)

    pipeline = Pipeline(stages=[tokenizer, remover, cv, idf, norm])
    model = pipeline.fit(df)

    featurized = model.transform(df).select("course_id", "language", "features")

    # 4) LSH similarity
    lsh = BucketedRandomProjectionLSH(
        inputCol="features",
        outputCol="hashes",
        bucketLength=args.bucket_length,
        numHashTables=args.num_hash_tables,
    )
    lsh_model = lsh.fit(featurized)
    hashed = lsh_model.transform(featurized).cache()

    # approxSimilarityJoin output uses datasetA/datasetB
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
    )

    pairs.cache()
    any_pair = pairs.limit(1).count()
    print(f"✅ Similarity pairs exist (same language)? {'YES' if any_pair > 0 else 'NO'}")

    if any_pair == 0:
        print("⚠️ No similarity pairs found within the threshold for same-language courses.")
        print("   Try increasing --max-dist or reducing --min-doc-freq.")

        # Still write empty arrays for every course (same output schema)
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

    # Keep best per (src,dst)
    pairs = pairs.groupBy("src", "dst").agg(F.max("score").alias("score"))

    # 5) Top-K per course
    w = Window.partitionBy("src").orderBy(F.desc("score"), F.asc("dst"))
    topk = (
        pairs.withColumn("rn", F.row_number().over(w))
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

    # Ensure every course appears in output
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
