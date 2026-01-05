// src/routes/courses.js
import { Router } from "express";
import { getCourses, getCourseById, createCourse } from "../controllers/coursesController.js";

const router = Router();

router.get("/", getCourses);
router.get("/:id", getCourseById);

// dev only
router.post("/", createCourse);

export default router;
