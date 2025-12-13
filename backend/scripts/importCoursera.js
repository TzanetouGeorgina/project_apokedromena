// backend/scripts/importCoursera.js
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import Course from "../src/models/Course.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Μόνο αυτά θεωρούμε valid "language" από Coursera dataset
const LANGUAGE_WHITELIST = new Set([
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Portuguese (Brazilian)",
  "Chinese",
  "Japanese",
  "Korean",
  "Arabic",
  "Russian",
  "Hindi",
  "Turkish",
  "Dutch",
  "Ukrainian",
  "Polish",
  "Swedish",
  "Norwegian",
  "Danish",
  "Greek",
  "Hebrew",
  "Thai",
  "Vietnamese",
  "Indonesian",
]);

const LEVEL_WHITELIST = new Set([
  "Beginner Level",
  "Intermediate Level",
  "Advanced Level",
  "Mixed",
  "All Levels",
]);

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function fixMalformedLeadingQuote(line) {
  if (!line.startsWith('"')) return line;

  const firstComma = line.indexOf(",");
  const nextQuote = line.indexOf('"', 1);

  if (firstComma !== -1 && nextQuote !== -1 && firstComma < nextQuote) {
    return line.slice(1);
  }
  return line;
}

function cleanText(v, fallback = "unknown") {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  if (!s || s === "-") return fallback;
  return s;
}

function parseLastUpdated(tsRaw) {
  if (!tsRaw) return null;
  const cleaned = String(tsRaw).split(";")[0].replace(/"/g, "").trim();
  if (!cleaned) return null;
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeLanguageStrict(v) {
  const s = cleanText(v, "unknown");
  if (s === "unknown") return "unknown";
  // ΜΟΝΟ whitelist
  return LANGUAGE_WHITELIST.has(s) ? s : "unknown";
}

function normalizeLevelStrict(v) {
  const s = cleanText(v, "unknown");
  if (s === "unknown") return "unknown";
  return LEVEL_WHITELIST.has(s) ? s : "unknown";
}

// Αν σε κάποιες γραμμές τα (language, level) μετακινούνται 1-2 θέσεις,
// ψάχνουμε ΜΟΝΟ σε ένα μικρό “παράθυρο” γύρω από τα indexes.
function findInWindow(fields, start, end, whitelist) {
  for (let i = start; i <= end && i < fields.length; i++) {
    const val = cleanText(fields[i], "unknown");
    if (whitelist.has(val)) return val;
  }
  return "unknown";
}

async function importCoursera() {
  await connectDB();

  const filePath = path.join(__dirname, "..", "data", "coursera.csv");
  console.log("📥 Reading Coursera CSV from:", filePath);

  console.log("🧹 Deleting old Coursera CSV records...");
  await Course.deleteMany({ "source.name": "Coursera CSV" });

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  let inserted = 0;
  const batch = [];
  const BATCH_SIZE = 1000;

  for await (const line of rl) {
    const raw = line.trim();
    if (!raw) continue;

    const normalized = raw.replace(/^\uFEFF/, "");
    const fixed = fixMalformedLeadingQuote(normalized);

    const fields = parseCsvLine(fixed);
    if (fields.length < 12) continue;

    // Αναμενόμενη δομή:
    // 0 url
    // 1 title
    // 2 org
    // 3 type
    // 4 image
    // 5 category
    // 6 certificate
    // 7 description
    // 8 duration
    // 9 language
    // 10 level
    // last = timestamp (με ;;;;;)
    const url = cleanText(fields[0], "");
    const title = cleanText(fields[1], "Untitled course");
    const org = cleanText(fields[2], "");
    const category = cleanText(fields[5], "");

    const description = cleanText(fields[7], "No description");

    // Strict: πρώτα δοκιμάζουμε τα “σωστά” indexes
    let language = normalizeLanguageStrict(fields[9]);
    let level = normalizeLevelStrict(fields[10]);

    // Window fallback (ΜΟΝΟ κοντά, όχι σε όλη τη γραμμή)
    if (language === "unknown") {
      language = findInWindow(fields, 8, 12, LANGUAGE_WHITELIST);
    }
    if (level === "unknown") {
      level = findInWindow(fields, 8, 14, LEVEL_WHITELIST);
    }

    const lastUpdated = parseLastUpdated(fields[fields.length - 1]);

    const keywords = [org, category].filter((x) => x && x !== "unknown" && x !== "-");

    batch.push({
      title,
      shortDescription: description,
      keywords,
      language,
      level,
      source: { name: "Coursera CSV", url: "https://www.coursera.org" },
      accessLink: url || "https://www.coursera.org",
      lastUpdated,
    });

    if (batch.length >= BATCH_SIZE) {
      await Course.insertMany(batch, { ordered: false });
      inserted += batch.length;
      batch.length = 0;
    }
  }

  if (batch.length) {
    await Course.insertMany(batch, { ordered: false });
    inserted += batch.length;
  }

  console.log("✅ Coursera import finished. Inserted:", inserted);
}

importCoursera()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Import failed:", err);
    process.exit(1);
  });
