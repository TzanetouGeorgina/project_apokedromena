import os
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

# =========================
# Mongo configuration
# =========================
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
DB_NAME = "courses_db"
COURSES_COLLECTION = "courses"
TEST_COLLECTION = "spark_test"

print("Starting Spark job...")
print("Mongo URI:", MONGO_URI)
print("Database:", DB_NAME)

# =========================
# Spark session
# =========================
spark = (
    SparkSession.builder
    .appName("spark-mongo-connection-test")
    .config("spark.mongodb.read.connection.uri", MONGO_URI)
    .config("spark.mongodb.write.connection.uri", MONGO_URI)
    .config("spark.mongodb.read.database", DB_NAME)
    .config("spark.mongodb.write.database", DB_NAME)
    .getOrCreate()
)

# =========================
# READ TEST
# =========================
print("Reading courses from MongoDB...")

courses_df = (
    spark.read
    .format("mongodb")
    .option("collection", COURSES_COLLECTION)
    .load()
)

count = courses_df.count()
print(f"READ OK - Found {count} courses")

courses_df.select(
    "title",
    "language",
    F.col("source.name").alias("source")
).show(5, truncate=True)

# =========================
# WRITE TEST
# =========================
print("Writing test document to MongoDB...")

test_df = (
    spark.createDataFrame([("spark_ok",)], ["status"])
    .withColumn("timestamp", F.current_timestamp())
)

(
    test_df.write
    .format("mongodb")
    .option("collection", TEST_COLLECTION)
    .mode("append")
    .save()
)

print(f"WRITE OK - Document written to {DB_NAME}.{TEST_COLLECTION}")

# =========================
# Finish
# =========================
spark.stop()
print("Spark job finished successfully.")
