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

// μονο γνωστές γλώσσες και levels kai άγνωστα μπαίνουν unknown

 
const LANGUAGE_WHITELIST = new Set([
  "English","Spanish","French","German","Italian","Portuguese","Portuguese (Brazilian)",
  "Chinese","Japanese","Korean","Arabic","Russian","Hindi","Turkish","Dutch","Ukrainian",
  "Polish","Swedish","Norwegian","Danish","Greek","Hebrew","Thai","Vietnamese","Indonesian",
]);

const LEVEL_WHITELIST = new Set([
  "Beginner Level","Intermediate Level","Advanced Level","Mixed","All Levels",
]);


//χειρίζεται quoted fields
// χειρίζεται ""
//  χωρίζει με κόμμα μονο όταν δεν είσαι μέσα σε quotes
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'; i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

//Κάποια lines ξεκινάνε με εξτρα quote που χαλάειτο parsing και προσπαθούμε να το φτιαξουμε
function fixMalformedLeadingQuote(line) {
  if (!line.startsWith('"')) return line;
  const firstComma = line.indexOf(",");
  const nextQuote = line.indexOf('"', 1);
   // Αν το πρώτο κόμμα  πριν κλείσει το quote μπορεί να εχει stray quote στην αρχή
  if (firstComma !== -1 && nextQuote !== -1 && firstComma < nextQuote) return line.slice(1);
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
  return LANGUAGE_WHITELIST.has(s) ? s : "unknown";
}

function normalizeLevelStrict(v) {
  const s = cleanText(v, "unknown");
  if (s === "unknown") return "unknown";
  return LEVEL_WHITELIST.has(s) ? s : "unknown";
}

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
  console.log("Reading Coursera CSV from:", filePath);

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  const SOURCE_NAME = "Coursera CSV";
  const SOURCE_URL = "https://www.coursera.org";

  let processed = 0;
  let skipped = 0;

  const BATCH_SIZE = 1000;
  let ops = [];

  async function flush() {
    if (!ops.length) return;
    await Course.bulkWrite(ops, { ordered: false });
    ops = [];
  }

  for await (const line of rl) {
    const raw = line.trim();
    if (!raw) continue;

    processed++;

    const normalized = raw.replace(/^\uFEFF/, "");
    const fixed = fixMalformedLeadingQuote(normalized);
    const fields = parseCsvLine(fixed);

     // Αν είναι πολύ λίγα fields κανει skip 
    if (fields.length < 12) {
      skipped++;
      continue;
    }

    const url = cleanText(fields[0], "");
    if (!url) { // χωρίς stable URL δεν κάνουμε write
      skipped++;
      continue;
    }

    // Βασικά πεδία
    const title = cleanText(fields[1], "Untitled course");
    const org = cleanText(fields[2], "");
    const category = cleanText(fields[5], "");
    const description = cleanText(fields[7], "No description");

    let language = normalizeLanguageStrict(fields[9]);
    let level = normalizeLevelStrict(fields[10]);

     // Αν βγήκαν unknown ψάχνουμε κοντά
    if (language === "unknown") language = findInWindow(fields, 8, 12, LANGUAGE_WHITELIST);
    if (level === "unknown") level = findInWindow(fields, 8, 14, LEVEL_WHITELIST);

    const lastUpdated = parseLastUpdated(fields[fields.length - 1]);
    const keywords = [org, category].filter((x) => x && x !== "unknown" && x !== "-");

    const courseDoc = {
      title,
      shortDescription: description,
      keywords,
      language,
      level,
      source: { name: SOURCE_NAME, url: SOURCE_URL },
      accessLink: url,
      lastUpdated,
      externalId: url,
    };

    // upsert
    ops.push({
      updateOne: {
        filter: { "source.name": SOURCE_NAME, accessLink: url },
        update: { $set: courseDoc },
        upsert: true,
      },
    });

    if (ops.length >= BATCH_SIZE) await flush();
  }

  await flush();

  console.log("Coursera import finished.");
  console.log("Processed:", processed);
  console.log("Skipped:", skipped);
}

importCoursera()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
