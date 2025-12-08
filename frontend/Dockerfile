# 1. Ένα image με Node
FROM node:20-alpine

# 2. Φάκελος εργασίας μέσα στο container
WORKDIR /app

# 3. Αντέγραψε τα package.json πρώτα (για πιο γρήγορο build)
COPY package*.json ./

# 4. Εγκατάσταση dependencies
RUN npm install

# 5. Τώρα αντέγραψε όλο το υπόλοιπο project
COPY . .

# 6. Τρέχεις το Vite dev server
# --host 0.0.0.0 για να είναι ορατός από έξω (docker)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
