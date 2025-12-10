import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Course from "../src/models/Course.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toStringOrUnknown(v, fallback = "unknown") {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s === "" ? fallback : s;
}

function parseDate(value) {
  if (!value) return new Date();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

async function importUdemy() {
  await connectDB();

  // αν το αρχείο σου έχει άλλο όνομα, άλλαξε το "udemy.csv"
  const filePath = path.join(__dirname, "..", "data", "Course_info.csv");
  const batch = [];

  console.log("📥 Reading Udemy CSV from:", filePath);

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        // Columns από το dataset που είχες:
        // id,title,is_paid,price,headline,num_subscribers,avg_rating,
        // num_reviews,num_comments,num_lectures,content_length_min,
        // published_time,last_update_date,category,subcategory,topic,
        // language,course_url,instructor_name,instructor_url

        const course = {
          title: toStringOrUnknown(row.title, "Untitled course"),
          shortDescription: toStringOrUnknown(row.headline, ""),
          keywords: [
            row.category,
            row.subcategory,
            row.topic,
          ].filter(Boolean),

          language: toStringOrUnknown(row.language, "en"),
          level: "beginner", // default, όπως είχαμε πει

          source: {
            name: "Udemy CSV",
            url: "https://www.udemy.com",
          },

          accessLink: row.course_url
            ? (row.course_url.startsWith("http")
                ? row.course_url
                : `https://www.udemy.com${row.course_url}`)
            : "",

          lastUpdated: parseDate(row.last_update_date || row.published_time),
        };

        batch.push(course);
      })
      .on("end", async () => {
        try {
          console.log(`📦 Read ${batch.length} Udemy rows, inserting...`);

          if (!batch.length) {
            console.log("⚠ No rows found in Udemy CSV");
            return resolve();
          }

          await Course.insertMany(batch, { ordered: false });

          console.log("✅ Udemy import finished!");
          resolve();
        } catch (err) {
          console.error("❌ Udemy import error:", err);
          reject(err);
        }
      })
      .on("error", (err) => {
        console.error("❌ Error reading Udemy CSV:", err);
        reject(err);
      });
  });
}

importUdemy()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
