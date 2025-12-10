// backend/scripts/importCoursera.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Course from "../src/models/Course.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// βοηθός: string ή fallback
function toStringOrUnknown(v, fallback = "unknown") {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s === "" ? fallback : s;
}

// helper: παίρνουμε την τιμή του ΜΟΝΑΔΙΚΟΥ πεδίου που έχει το row
function getRawLine(row) {
  const values = Object.values(row);
  if (!values.length) return "";
  return String(values[0] ?? "");
}

// helper: κόβουμε τη γραμμή σε μέρη
function parseCourseraLine(rawLine) {
  // βγάζουμε εξωτερικά quotes αν υπάρχουν
  let cleaned = rawLine.trim();
  cleaned = cleaned.replace(/^"+|"+$/g, "");

  // χωρίζουμε με κόμμα. Ναι, θα “σπάσουν” μερικές περιγραφές,
  // αλλά για την εργασία μάς νοιάζουν κυρίως τα πρώτα πεδία.
  const parts = cleaned.split(",");

  // προσοχή στα index:
  // 0: url
  // 1: title
  // 2: university / company
  // 3: type (course / specialization / professional certificate)
  // 4: image url
  // 5: category-subject-area
  // 6: certificate-is-available
  // 7: description (μερικές φορές)
  // ...
  // 10: language
  // 11: level
  // ...
  // τελευταίο περίπου: timestamp + ;;;;;;;;

  const url = parts[0] || "";
  const title = parts[1] || "";
  const university = parts[2] || "";
  const category = parts[5] || "";
  const language = parts[10] || "en";
  const level = parts[11] || "unknown";

  // περιγραφή: παίρνουμε είτε το 7 είτε το 14 (syllabus), αν υπάρχει
  const descriptionCandidate = parts[7] || parts[14] || "";

  // timestamp: παίρνουμε το τελευταίο non-empty κομμάτι
  let timestamp = "";
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = (parts[i] || "").trim();
    if (p) {
      timestamp = p;
      break;
    }
  }

  return { url, title, university, category, language, level, descriptionCandidate, timestamp };
}

// helper: parse date ή null (κόβουμε τα ;) 
function parseDateFromPart(value) {
  if (!value) return null;
  const cleaned = String(value).split(";")[0].replace(/"/g, "").trim();
  if (!cleaned) return null;
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function importCoursera() {
  await connectDB();

  console.log("✅ Connected to MongoDB");
  console.log("📌 Connected to DB:", mongoose.connection.db.databaseName);
  console.log("📌 Using collection:", Course.collection.collectionName);

  const filePath = path.join(__dirname, "..", "data", "coursera.csv");
  console.log("📥 Reading Coursera CSV from:", filePath);

  const rows = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv()) // θα μας δώσει ένα object ανά γραμμή, με 1 μόνο πεδίο
      .on("data", (row) => {
        rows.push(row);
      })
      .on("end", async () => {
        try {
          console.log(`📦 Read ${rows.length} Coursera rows, mapping...`);

          if (!rows.length) {
            console.log("⚠ No rows found in Coursera CSV");
            return resolve();
          }

          const docs = rows.map((row) => {
            const rawLine = getRawLine(row);
            const {
              url,
              title,
              university,
              category,
              language,
              level,
              descriptionCandidate,
              timestamp,
            } = parseCourseraLine(rawLine);

            const keywords = [university, category].filter(Boolean);

            return {
              title: toStringOrUnknown(title, "Untitled course"),
              shortDescription: toStringOrUnknown(
                descriptionCandidate,
                "No description"
              ),
              keywords,
              language: toStringOrUnknown(language, "unknown"),
              level: toStringOrUnknown(level, "unknown"),
              source: {
                name: "Coursera CSV",
                url: "https://www.coursera.org",
              },
              accessLink: toStringOrUnknown(url, "https://www.coursera.org"),
              lastUpdated: parseDateFromPart(timestamp),
            };
          });

          console.log("🧹 Deleting old Coursera CSV data from collection...");
          await Course.deleteMany({ "source.name": "Coursera CSV" });

          console.log("💾 Inserting mapped documents...");
          const inserted = await Course.insertMany(docs, { ordered: true });

          console.log("✅ Coursera import finished!");
          console.log("📊 Actually inserted docs:", inserted.length);

          resolve();
        } catch (err) {
          console.error("❌ Coursera import error:", err);
          reject(err);
        }
      })
      .on("error", (err) => {
        console.error("❌ Error reading Coursera CSV:", err);
        reject(err);
      });
  });
}

importCoursera()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
