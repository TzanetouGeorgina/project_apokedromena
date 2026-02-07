***PROJECT***
Οριζόντιο Repository/Aggregator Ανοικτών Μαθημάτων με React Front-end και Spark για Large-Scale ML 

/// Περιγραφή

Το παρόν project υλοποιεί ένα σύστημα συλλογής, αποθήκευσης, αναζήτησης και σύστασης μαθημάτων από πολλαπλές πηγές. 

Τα δεδομένα ενοποιούνται σε κοινό σχήμα και αποθηκεύονται σε MongoDB.

Το σύστημα βασίζεται σε αρχιτεκτονική full-stack web application και αξιοποιεί PySpark για εξαγωγή παρόμοιων μαθημάτων μέσω τεχνικών text similarity.

/// Βασικές Λειτουργίες:

1. Αναζήτηση και Φιλτράρισμα μαθημάτων

2. Προβολή αναλυτικών πληροφοριών για το καθένα

3. Εμφάνιση παρόμοιων μαθημάτων (course similarity/recommendations)

4. Βασικά Analytics

/// Αρχιτεκτονική Συστήματος

React Frontend: διεπαφή χρήστη

Backend API: REST API/ πρόσβαση στα δεδομένα

Import scripts: συλλογή από δεδομένα εξωτερικών πηγών(csv)

  Τα import γίνονται με τις εντολές:
    docker compose run --rm backend node scripts/importCourse_info.js
    docker compose run --rm backend node scripts/importCoursera.js


MongoDB: αποθήκευση μαθημάτων και αποτελεσμάτων similarity

PySpark ML: υπολογισμός παρόμοιων μαθημάτων

Ο υπολογισμός των similar courses γίνεται μέσω PySpark job, το οποίο εκτελείται μέσα στο Spark container και συνδέεται απευθείας με τη MongoDB

docker compose exec spark /opt/spark/bin/spark-submit \
  --master local[*] \
  --conf spark.jars.ivy=/tmp/ivy2 \
  --conf spark.sql.warehouse.dir=/tmp/spark-warehouse \
  --packages org.mongodb.spark:mongo-spark-connector_2.12:10.5.0 \
  /opt/spark-app/similarity_job.py \
  --mongo-uri "mongodb://mongo:27017" \
  --db "courses_db" \
  --in-collection "courses" \
  --out-collection "course_similarity" \
  --k 5 \
  --id-col "_id" \
  --bucket-length 4.0 \
  --num-hash-tables 1 \
  --bucket-cap 120 \
  --min-cos 0.30 \
  --candidate-cap 50
  Η εκτέλεση γίνεται offline και τα αποτελέσματα χρησιμοποιούνται από το backend API και το frontend.


/// Tests

Υλοποιήθηκαν κάποια βασικά integration tests στο backend API για την επαλήθευση της σωστής λειτουργίας του συστήματος. Τα tests ελέγχουν την σωστή συνεργασία REST API και της βάσης δεδομένων MongoDB.

Η εκτέλεσή τους γίνεται με 
  docker compose run --rm \
  -e MONGO_URI=mongodb://mongo:27017/courses_db_test \
  backend npm test


/// Εκτέλεση 

Το project υλοποιήθηκε σε Docker containers

Για την εκτέλεση του συστήματος απαιτούνται:

- Docker

- Docker Compose [docker compose up --build]

- Σύγχρονος web browser

Παρακάτω παραθέτουμε και τις τεχνολογίες που χρησιμοποιούνται εσωτερικά στα container, αλλά δεν απαιτείται να είναι εγκατεστημένες τοπικά:

- Node.js (Frontend & Backend)

- Python 3 (PySpark)

- Java (Apache Spark)

- MongoDB


