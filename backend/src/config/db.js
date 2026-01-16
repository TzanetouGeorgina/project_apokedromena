// src/config/db.js
import mongoose from "mongoose";

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

