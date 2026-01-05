// src/controllers/coursesController.js
import mongoose from "mongoose";
import Course from "../models/Course.js";

function toUnknown(value) {
  if (value === undefined || value === null) return "unknown";
  if (typeof value === "string" && value.trim() === "") return "unknown";
  return value;
}

function formatCourse(courseDoc) {
  const course = courseDoc?.toObject ? courseDoc.toObject() : courseDoc;

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
    lastUpdated: course.lastUpdated ? new Date(course.lastUpdated).toISOString() : "unknown",
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

    const filters = {};
    if (language) filters.language = language;
    if (level) filters.level = level;
    if (source) filters["source.name"] = source;
    if (category) filters.keywords = { $in: [category] };

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNumber - 1) * pageSize;

    const search = (q || "").trim();

    let findQuery;
    let countFilter;

    if (search.length >= 2) {
      const textCriteria = { $text: { $search: search }, ...filters };
      findQuery = Course.find(textCriteria, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .skip(skip)
        .limit(pageSize)
        .lean();

      countFilter = textCriteria;
    } else {
      findQuery = Course.find(filters)
        .sort({ lastUpdated: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      countFilter = filters;
    }

    const [data, total] = await Promise.all([
      findQuery,
      Course.countDocuments(countFilter),
    ]);

    const pages = Math.ceil(total / pageSize);

    res.json({
      data: data.map(formatCourse),
      pagination: {
        page: pageNumber,
        pageSize,
        total,
        pages,
        hasPrev: pageNumber > 1,
        hasNext: pageNumber < pages,
      },
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

    const course = await Course.findById(id).lean();
    if (!course) return res.status(404).json({ error: "Course not found" });

    res.json(formatCourse(course));
  } catch (err) {
    console.error("getCourseById error:", err);
    res.status(500).json({ error: "Internal server error" });
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
