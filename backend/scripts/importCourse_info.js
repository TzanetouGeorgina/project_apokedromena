import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Course from "../src/models/Course.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: καθαρίζει strings, αφαιρεί περιττά quotes/spaces
function cleanStr(v) {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/\uFEFF/g, "") // BOM
    .trim()
    .replace(/^"+|"+$/g, ""); // remove surrounding quotes
}

function toStringOrUnknown(v, fallback = "unknown") {
  const s = cleanStr(v);
  return s ? s : fallback;
}

function toStringOrEmpty(v) {
  return cleanStr(v) || "";
}

function toNumberOrNull(v) {
  const s = cleanStr(v);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDateOrNull(v) {
  const s = cleanStr(v);
  if (!s || s === "-" || s.toLowerCase() === "nan") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Udemy URLs:
 * - Μερικά datasets έχουν full url
 * - Μερικά έχουν /course/xxx
 */
function normalizeUdemyUrl(v) {
  const s = cleanStr(v);
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `https://www.udemy.com${s}`;
  // fallback: αν έχει κάτι σαν "www.udemy.com/...."
  if (s.startsWith("www.")) return `https://${s}`;
  return s;
}

/**
 * Level mapping:
 * πολλά Udemy datasets δεν έχουν level.
 * Αν έχει κάτι σαν "Beginner" / "All Levels" κλπ, το κανονικοποιούμε.
 */
function normalizeLevel(v) {
  const s = cleanStr(v).toLowerCase();
  if (!s || s === "-" ) return "unknown";
  if (s.includes("beginner")) return "beginner";
  if (s.includes("intermediate")) return "intermediate";
  if (s.includes("advanced")) return "advanced";
  if (s.includes("all")) return "unknown"; // "All Levels" -> unknown (ή beginner αν θες)
  return "unknown";
}

/**
 * Language normalization:
 * το dataset συχνά έχει "English", "Spanish", κλπ.
 * Αν είναι κενό -> "unknown"
 */
function normalizeLanguage(v) {
  const s = cleanStr(v);
  return s ? s : "unknown";
}

/**
 * Keywords:
 * παίρνουμε category/subcategory/topic αν υπάρχουν
 */
function buildKeywords(row) {
  const cat = cleanStr(row.category);
  const sub = cleanStr(row.subcategory);
  const topic = cleanStr(row.topic);

  const arr = [cat, sub, topic]
    .map(x => x.trim())
    .filter(Boolean)
    .filter(x => x !== "-");

  // unique
  return [...new Set(arr)];
}

async function importUdemy() {
  await connectDB();

  // άλλαξε εδώ αν έχεις άλλο path/όνομα
  const filePath = path.join(__dirname, "..", "data", "Course_info.csv");

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found at: ${filePath}`);
  }

  console.log("📥 Reading Udemy CSV from:", filePath);

  let processed = 0;
  let upserted = 0;
  let skipped = 0;

  // Για να μην κάνουμε 290* updateOne σειριακά, κάνουμε bulkWrite σε batches
  const BATCH_SIZE = 500;
  let ops = [];

  function flushOps() {
    if (!ops.length) return Promise.resolve();
    const toRun = ops;
    ops = [];
    return Course.bulkWrite(toRun, { ordered: false }).then((res) => {
      // modifiedCount + upsertedCount δεν είναι πάντα τέλεια με bulkWrite,
      // αλλά θα σου δώσει ένα indication
      upserted += (res.upsertedCount || 0);
    });
  }

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        try {
          processed++;

          // Βασικά fields από dataset (όπως είχες γράψει):
          // id,title,is_paid,price,headline,num_subscribers,avg_rating,
          // num_reviews,num_comments,num_lectures,content_length_min,
          // published_time,last_update_date,category,subcategory,topic,
          // language,course_url,instructor_name,instructor_url

          const title = toStringOrUnknown(row.title, "Untitled course");
          const shortDescription = toStringOrEmpty(row.headline) || "No description";
          const accessLink = normalizeUdemyUrl(row.course_url);

          // Αν δεν έχει url, δεν μπορούμε να κάνουμε dedup σωστά -> skip
          if (!accessLink) {
            skipped++;
            return;
          }

          const lastUpdated =
            parseDateOrNull(row.last_update_date) ||
            parseDateOrNull(row.published_time) ||
            null;

          const courseDoc = {
            title,
            shortDescription,
            keywords: buildKeywords(row),
            language: normalizeLanguage(row.language),
            level: normalizeLevel(row.level), // αν δεν υπάρχει στήλη level -> θα πάει unknown
            source: {
              name: "Udemy CSV",
              url: "https://www.udemy.com",
            },
            accessLink,
            lastUpdated,
          
          };

          //  Upsert by accessLink (no duplicates)
          ops.push({
            updateOne: {
              filter: { accessLink },
              update: { $set: courseDoc },
              upsert: true,
            },
          });

          if (ops.length >= BATCH_SIZE) {
            // pause stream, flush, resume
            stream.pause();
            flushOps()
              .then(() => stream.resume())
              .catch(reject);
          }
        } catch (e) {
          skipped++;
        }
      })
      .on("end", async () => {
        try {
          await flushOps();
          console.log("Udemy import finished!");
          console.log(`Processed: ${processed}`);
          console.log(`Skipped (no url / bad row): ${skipped}`);
          console.log(`Upserted (new docs): ~${upserted}`);
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .on("error", reject);

    const stream = fs.createReadStream(filePath).pipe(csv());
  });
}

importUdemy()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Udemy import error:", err);
    process.exit(1);
  });
