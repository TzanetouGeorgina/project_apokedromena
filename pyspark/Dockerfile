FROM spark:3.5.1

USER root

# Εγκατάσταση numpy (αυτό λείπει και σου έσκασε το job)
# Αν δεν υπάρχει pip3 στο image, θα το βάλουμε με apt-get (δες παρακάτω fallback)
RUN python3 -m pip install --no-cache-dir numpy

USER spark
WORKDIR /opt/spark-app
