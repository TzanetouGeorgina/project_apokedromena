import mongoose from "mongoose";
import Course from "../models/Course.js";

// Helper: μετατρέπει null/undefined/κενό string σε "unknown"
function toUnknown(value) {
  if (value === undefined || value === null) return "unknown";
  if (typeof value === "string" && value.trim() === "") return "unknown";
  return value;
}

// Μορφοποίηση course πριν το στείλουμε στο frontend
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
    lastUpdated: course.lastUpdated
      ? course.lastUpdated.toISOString()
      : "unknown",
    // αν θες, μπορείς να επιστρέφεις κι άλλα πεδία (price, rating, κτλ)
  };
}

//   GET /courses//   με search, filters & pagination
export async function getCourses(req, res) {
  try {
    const {
      q,            // search text
      language,
      level,
      source,
      category,
      page = 1,
      limit = 20,
    } = req.query;

    const filters = {};

    if (language) {
      filters.language = language;
    }

    if (level) {
      filters.level = level;
    }

    if (source) {
      filters["source.name"] = source;
    }

    // Στο schema μας δεν έχουμε "categories" αλλά keywords[]
    if (category) {
      filters.keywords = category;
    }

    let query;
    let countFilter;

    if (q) {
      // text search (χρησιμοποιεί το text index από το schema)
      const textCriteria = { $text: { $search: q }, ...filters };

      query = Course.find(
        textCriteria,
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } });

      countFilter = textCriteria;
    } else {
      query = Course.find(filters).sort({ createdAt: -1 });
      countFilter = filters;
    }

    const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 20;
    const skip = (pageNumber - 1) * pageSize;

    const [data, total] = await Promise.all([
      query.skip(skip).limit(pageSize),
      Course.countDocuments(countFilter),
    ]);

    res.json({
      data: data.map(formatCourse),
      pagination: {
        page: pageNumber,
        pageSize,
        total,
      },
    });
  } catch (err) {
    console.error("getCourses error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

//   GET /courses/:id

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

//   POST /courses//   για χειροκίνητη δημιουργία με Postman)

export async function createCourse(req, res) {
  try {
    const course = await Course.create(req.body);
    res.status(201).json(formatCourse(course));
  } catch (err) {
    console.error("createCourse error:", err);
    res.status(400).json({ error: err.message });
  }
}
