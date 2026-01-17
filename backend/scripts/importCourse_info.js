// backend/scripts/importCourse_info.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";


import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Course from "../src/models/Course.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cleanStr(v) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/\uFEFF/g, "").trim().replace(/^"+|"+$/g, "");
}
function toStringOrUnknown(v, fallback = "unknown") {
  const s = cleanStr(v);
  return s ? s : fallback;
}
function toStringOrEmpty(v) {
  return cleanStr(v) || "";
}
function parseDateOrNull(v) {
  const s = cleanStr(v);
  if (!s || s === "-" || s.toLowerCase() === "nan") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function normalizeUdemyUrl(v) {
  const s0 = cleanStr(v);
  if (!s0) return "";
  let s = s0;

  if (!s.startsWith("http://") && !s.startsWith("https://")) {
    if (s.startsWith("/")) s = `https://www.udemy.com${s}`;
    else if (s.startsWith("www.")) s = `https://${s}`;
  }

  // drop query string
  s = s.split("#")[0].split("?")[0];

  // remove slash
  if (s.endsWith("/")) s = s.slice(0, -1);

  return s;
}

function normalizeLevel(v) {
  const s = cleanStr(v).toLowerCase();
  if (!s || s === "-") return "unknown";
  if (s.includes("beginner")) return "beginner";
  if (s.includes("intermediate")) return "intermediate";
  if (s.includes("advanced")) return "advanced";
  if (s.includes("all")) return "unknown";
  return "unknown";
}
function normalizeLanguage(v) {
  const s = cleanStr(v);
  return s ? s : "unknown";
}
function buildKeywords(row) {
  const cat = cleanStr(row.category);
  const sub = cleanStr(row.subcategory);
  const topic = cleanStr(row.topic);

  const arr = [cat, sub, topic].map((x) => x.trim()).filter(Boolean).filter((x) => x !== "-");
  return [...new Set(arr)];
}

async function importUdemy() {
  await connectDB();

  const filePath = path.join(__dirname, "..", "data", "Course_info_n.csv");
  if (!fs.existsSync(filePath)) throw new Error(`CSV not found at: ${filePath}`);

  console.log("Reading Udemy CSV from:", filePath);

  const SOURCE_NAME = "Udemy CSV";
  const SOURCE_URL = "https://www.udemy.com";

  let processed = 0;
  let skipped = 0;
  let upsertedTotal = 0;
  let modifiedTotal = 0;

  const BATCH_SIZE = 500;
  let ops = [];

  async function flushOps() {
    if (!ops.length) return { upserted: 0, modified: 0 };
    const toRun = ops;
    ops = [];
    const res = await Course.bulkWrite(toRun, { ordered: false });
    return { upserted: res.upsertedCount || 0, modified: res.modifiedCount || 0 };
  }
const ENCODING = "utf8";

 const stream = fs
  .createReadStream(filePath, { encoding: "utf8" })
  .pipe(csv());

  return new Promise((resolve, reject) => {
    stream
      .on("data", async (row) => {
        stream.pause();
        try {
          processed++;

          const title = toStringOrUnknown(row.title, "Untitled course");
          const shortDescription = toStringOrEmpty(row.desc) || toStringOrEmpty(row.headline) ||  "No description";

          const accessLink = normalizeUdemyUrl(row.course_url);

          if (!accessLink) {
            skipped++;
            stream.resume();
            return;
          }

          const lastUpdated =
            parseDateOrNull(row.last_update_date) ||
            parseDateOrNull(row.published_time) ||
            null;

          const externalId = cleanStr(row.id) || "";

          const courseDoc = {
            title,
            shortDescription,
            keywords: buildKeywords(row),
            language: normalizeLanguage(row.language),
            level: normalizeLevel(row.level),
            source: { name: SOURCE_NAME, url: SOURCE_URL },
            accessLink,
            lastUpdated,
            externalId,
          };

          ops.push({
            updateOne: {
              filter: { "source.name": SOURCE_NAME, accessLink },
              update: { $set: courseDoc },
              upsert: true,
            },
          });

          if (ops.length >= BATCH_SIZE) {
            const stats = await flushOps();
            upsertedTotal += stats.upserted;
            modifiedTotal += stats.modified;
          }

          stream.resume();
        } catch (e) {
          skipped++;
          stream.resume();
        }
      })
      .on("end", async () => {
        try {
          const stats = await flushOps();
          upsertedTotal += stats.upserted;
          modifiedTotal += stats.modified;

          console.log("Udemy import finished!");
          console.log(`Processed: ${processed}`);
          console.log(`Skipped: ${skipped}`);
          console.log(`Upserted: ${upsertedTotal}`);
          console.log(`Modified: ${modifiedTotal}`);
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .on("error", reject);
  });
}

importUdemy()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(" Udemy import error:", err);
    process.exit(1);
  });
