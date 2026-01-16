// backend/src/controllers/coursesController.js
import mongoose from "mongoose";
import Course from "../models/Course.js";

// Helper: μετατρέπει null/undefined/κενό string σε "unknown"
function toUnknown(value) {
  if (value === undefined || value === null) return "unknown";
  if (typeof value === "string" && value.trim() === "") return "unknown";
  return value;
}

// Μορφοποίηση course πριν το στείλουμε στο frontend / export
function formatCourse(courseDoc) {
  const course = courseDoc?.toObject ? courseDoc.toObject() : courseDoc;

  return {
    id: course?._id,
    title: toUnknown(course?.title),
    shortDescription: toUnknown(course?.shortDescription),
    keywords: course?.keywords ?? [],
    language: toUnknown(course?.language),
    level: toUnknown(course?.level),
    source: {
      name: toUnknown(course?.source?.name),
      url: toUnknown(course?.source?.url),
    },
    accessLink: toUnknown(course?.accessLink),
    lastUpdated: course?.lastUpdated ? new Date(course.lastUpdated).toISOString() : "unknown",
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

    // Στο schema δεν έχουμε category field, οπότε χρησιμοποιούμε keywords[]
    if (category) filters.keywords = category;

    let query;
    let countFilter;

    if (q) {
      const textCriteria = { $text: { $search: q }, ...filters };

      query = Course.find(textCriteria, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } });

      countFilter = textCriteria;
    } else {
      query = Course.find(filters).sort({ createdAt: -1 });
      countFilter = filters;
    }

    const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 80;
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

// GET /courses/:id
export async function getCourseById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid course id" });
    }

    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ error: "Course not found" });

    res.json(formatCourse(course));
  } catch (err) {
    console.error("getCourseById error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// POST /courses
export async function createCourse(req, res) {
  try {
    const course = await Course.create(req.body);
    res.status(201).json(formatCourse(course));
  } catch (err) {
    console.error("createCourse error:", err);
    res.status(400).json({ error: err.message });
  }
}

/**
 * GET /courses/export
 * Query params:
 * - format: jsonl (default) | json | csv
 * - source, language, level: optional filters
 */
export async function exportCourses(req, res) {
  try {
    const { format = "jsonl", source, language, level } = req.query;

    const filters = {};
    if (source) filters["source.name"] = source;
    if (language) filters.language = language;
    if (level) filters.level = level;

    // minimal projection for export
    const projection = {
      title: 1,
      shortDescription: 1,
      keywords: 1,
      language: 1,
      level: 1,
      source: 1,
      accessLink: 1,
      lastUpdated: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const cursor = Course.find(filters, projection).lean().cursor();

    if (format === "json") {
      const all = [];
      for await (const doc of cursor) all.push(formatCourse(doc));

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=courses.json");
      return res.status(200).json(all);
    }

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=courses.csv");

      // header
      res.write(
        "id,title,shortDescription,keywords,language,level,sourceName,sourceUrl,accessLink,lastUpdated\n"
      );

      const esc = (v) => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      };

      for await (const doc of cursor) {
        const c = formatCourse(doc);
        res.write(
          [
            esc(c.id),
            esc(c.title),
            esc(c.shortDescription),
            esc((c.keywords || []).join("|")),
            esc(c.language),
            esc(c.level),
            esc(c.source?.name),
            esc(c.source?.url),
            esc(c.accessLink),
            esc(c.lastUpdated),
          ].join(",") + "\n"
        );
      }

      return res.end();
    }

    // default: jsonl 
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=courses.jsonl");

    for await (const doc of cursor) {
      res.write(JSON.stringify(formatCourse(doc)) + "\n");
    }
    return res.end();
  } catch (err) {
    console.error("exportCourses error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /courses/:id/similar
export async function getSimilarCourses(req, res) {
  return res.json({ data: [] });
}
