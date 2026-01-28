import mongoose from "mongoose";
import Course from "../models/Course.js";
import CourseSimilarity from "../models/CourseSimilarity.js";

// Helper: μετατρέπει null/undefined/κενό string σε "unknown"
function toUnknown(value) {
  if (value === undefined || value === null) return "unknown";
  if (typeof value === "string" && value.trim() === "") return "unknown";
  return value;
}

// Μορφοποίηση course πριν το στείλουμε στο frontend
// Και μετατροπή ενός Course  σε object που επιστρέφει το API
function formatCourse(courseDoc) {
  const course = courseDoc.toObject ? courseDoc.toObject() : courseDoc;

  return {
    id: course._id,
    title: toUnknown(course.title),
    shortDescription: toUnknown(course.shortDescription),
    keywords: course.keywords ?? [],
    language: toUnknown(course.language),
    level: toUnknown(course.level),
    source: {
      name: toUnknown(course.source?.name),
      url: toUnknown(course.source?.url),
    },
    accessLink: toUnknown(course.accessLink),
    lastUpdated: course.lastUpdated ? course.lastUpdated.toISOString() : "unknown",
  };
}

// GET /courses  (search, filters, pagination)
export async function getCourses(req, res) {
  try {
    const {
      q,
      language,
      level,
      source,
      category,
      page = 1,
      limit = 20,
    } = req.query;

    // Φτιάχνουμε δυναμικά filter object
    const filters = {};

    if (language) filters.language = language;
    if (level) filters.level = level;
    if (source) filters["source.name"] = source;

    // keywords[] για να κανουν match σε οποιοδήποτε element
    if (category) filters.keywords = category;

    let query;
    let countFilter;

    // Όταν χρησιμοποιούμε $text search ζητάμε το textScore από τη Mongo
    // και ταξινομούμε τα αποτελέσματα με βάση τη σχετικότητα 
    if (q) {
      const textCriteria = { $text: { $search: q }, ...filters };

      query = Course.find(textCriteria, { score: { $meta: "textScore" } }).sort({
        score: { $meta: "textScore" },
      });

      countFilter = textCriteria;
    } else {
      query = Course.find(filters).sort({ createdAt: -1 });
      countFilter = filters;
    }

    // Pagination: μετατρέπουμε σε αριθμούς με defaults
    const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 20;
    const skip = (pageNumber - 1) * pageSize;

    const [data, total] = await Promise.all([
      query.skip(skip).limit(pageSize),
      Course.countDocuments(countFilter),
    ]);

    res.json({
      data: data.map(formatCourse),
      pagination: { page: pageNumber, pageSize, total },
    });
  } catch (err) {
    console.error("getCourses error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /courses/:id
export async function getCourseById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid course id" });
    }

    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.json(formatCourse(course));
  } catch (err) {
    console.error("getCourseById error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /courses/:id/similar
export async function getSimilarCourses(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid course id" });
    }

    // Το Spark γράφει στο course_similarity με courseId ως string
    const sim = await CourseSimilarity.findOne({ courseId: String(id) }).lean();

    if (!sim || !Array.isArray(sim.similar_ids) || sim.similar_ids.length === 0) {
      return res.json({
        data: [],
        pagination: { page: 1, pageSize: 0, total: 0 },
      });
    }

    // /courses/:id/similar?limit=10
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const ids = sim.similar_ids.slice(0, limit);

    // Φέρνουμε τα courses
    const courses = await Course.find({ _id: { $in: ids } });

    // Κρατάμε τη σειρά που έδωσε το Spark
    const byId = new Map(courses.map((c) => [String(c._id), c]));
    const ordered = ids.map((cid) => byId.get(String(cid))).filter(Boolean);

    res.json({
      data: ordered.map(formatCourse),
      pagination: { page: 1, pageSize: ordered.length, total: ordered.length },

    });
  } catch (err) {
    console.error("getSimilarCourses error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /courses/meta  για δυναμικά φίλτρα
export async function getCoursesMeta(req, res) {
  try {
    const [languages, levels, sources, categories] = await Promise.all([
      Course.distinct("language"),
      Course.distinct("level"),
      Course.distinct("source.name"),
      Course.distinct("keywords"), // distinct πάνω σε array και φέρνει τα elements
    ]);

    const clean = (arr) =>
      (arr ?? [])
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
        .map((v) => String(v).trim());

    res.json({
      languages: clean(languages).sort((a, b) => a.localeCompare(b)),
      levels: clean(levels).sort((a, b) => a.localeCompare(b)),
      sources: clean(sources).sort((a, b) => a.localeCompare(b)),
      categories: clean(categories).sort((a, b) => a.localeCompare(b)),
    });
  } catch (err) {
    console.error("getCoursesMeta error:", err);
    res.status(500).json({ error: "Failed to load metadata" });
  }
}

// POST /courses (dev)
export async function createCourse(req, res) {
  try {
    const course = await Course.create(req.body);
    res.status(201).json(formatCourse(course));
  } catch (err) {
    console.error("createCourse error:", err);
    res.status(400).json({ error: err.message });
  }
}

// GET /courses/stats  για analytics
export async function getCourseStats(req, res) {
  try {
    const total = await Course.countDocuments({});

    const bySource = await Course.aggregate([
      { $group: { _id: "$source.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const byLanguage = await Course.aggregate([
      { $group: { _id: "$language", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const byLevel = await Course.aggregate([
      { $group: { _id: "$level", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    //  βγάζουμε top keywords
    const topKeywords = await Course.aggregate([
      { $unwind: "$keywords" },
      {
        $match: {
          keywords: { $nin: [null, "", "unknown", "Unknown"] },
        },
      },
      { $group: { _id: "$keywords", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    res.json({ total, bySource, byLanguage, byLevel, topKeywords });
  } catch (err) {
    console.error("getCourseStats error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
}
