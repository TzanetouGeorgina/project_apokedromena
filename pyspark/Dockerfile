FROM python:3.12-slim

# Εγκατάσταση βιβλιοθηκών που χρειάζεσαι
RUN pip install --no-cache-dir pyspark psycopg2-binary

WORKDIR /app

# Αντέγραψε μόνο ό,τι χρειάζεται (προς το παρόν main.py)
COPY main.py .

CMD ["python", "main.py"]
