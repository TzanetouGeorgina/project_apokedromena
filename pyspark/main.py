import os
import psycopg2

db_host = os.environ["DB_HOST"]
db_port = os.environ["DB_PORT"]
db_user = os.environ["DB_USER"]
db_password = os.environ["DB_PASSWORD"]
db_name = os.environ["DB_NAME"]

print("Connecting to DB...", db_host, db_port, db_name)

conn = psycopg2.connect(
    host=db_host,
    port=db_port,
    user=db_user,
    password=db_password,
    dbname=db_name,
)

cur = conn.cursor()
cur.execute("SELECT 1;")
print("DB OK, result:", cur.fetchone())

cur.close()
conn.close()
print("All good, Spark container can reach DB!")
