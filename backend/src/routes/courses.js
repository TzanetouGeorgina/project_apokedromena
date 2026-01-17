import { Router } from "express";
import {
  getCourses,
  getCourseById,
  createCourse,
  getCoursesMeta,
  getSimilarCourses,
} from "../controllers/coursesController.js";

const router = Router();

router.get("/", getCourses);
router.get("/meta", getCoursesMeta);

// ΠΡΕΠΕΙ να είναι εδώ
router.get("/:id/similar", getSimilarCourses);

router.get("/:id", getCourseById);
router.post("/", createCourse);

export default router;
