// src/config/db.js
import mongoose from "mongoose";

/**
 * Συνδέεται στη MongoDB και επιστρέφει το mongoose connection
 *  Διαβάζει MONGO_URI από .env
 *  Βάζει listeners για debugging για κατασταση σύνδεσης
 *  Κάνει process.exit(1) αν αποτύχει (ώστε να μην “τρέχει” API χωρίς DB)
 */
export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not defined in .env");

  try {
    mongoose.connection.on("connected", () => console.log("MongoDB connected"));
    mongoose.connection.on("error", (err) => console.error("MongoDB error:", err));
    mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));

    await mongoose.connect(uri, {
      dbName: "courses_db",
      serverSelectionTimeoutMS: 5000,
    });

    return mongoose.connection;
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

