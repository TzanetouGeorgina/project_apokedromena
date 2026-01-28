// src/index.js
import "dotenv/config";

// connectDB: ανοίγει σύνδεση στη MongoDB μέσω mongoose
import { connectDB } from "./config/db.js";

// app: Express instance 
import app from "./app.js";

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();

  // Εκκίνηση HTTP server
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
