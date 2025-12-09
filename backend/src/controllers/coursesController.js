import mongoose from "mongoose";
import Course from "../models/Course.js";

export async function getCourses(req, res) {
  try {
    const {
      q,            // search text
      language,
      level,
      source,
      category,
      page = 1,
      limit = 20
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

    if (category) {
      filters.categories = category;
    }

    let query;
    if (q) {
      // text search αν υπάρχει index
      query = Course.find(
        { $text: { $search: q }, ...filters },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } });
    } else {
      query = Course.find(filters).sort({ createdAt: -1 });
    }

    const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 20;
    const skip = (pageNumber - 1) * pageSize;

    const [data, total] = await Promise.all([
      query.skip(skip).limit(pageSize),
      Course.countDocuments(filters)
    ]);

    res.json({
      data,
      pagination: {
        page: pageNumber,
        pageSize,
        total
      }
    });
  } catch (err) {
    console.error("getCourses error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

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

    res.json(course);
  } catch (err) {
    console.error("getCourseById error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Προαιρετικό: για να δημιουργείς χειροκίνητα courses με Postman
export async function createCourse(req, res) {
  try {
    const course = await Course.create(req.body);
    res.status(201).json(course);
  } catch (err) {
    console.error("createCourse error:", err);
    res.status(400).json({ error: err.message });
  }
}
