import { Router } from "express";
import {
  getCourses,
  getCourseById,
  createCourse,
  getCoursesMeta,
  getSimilarCourses,
  getCourseStats,
} from "../controllers/coursesController.js";

const router = Router();

router.get("/", getCourses);
router.get("/meta", getCoursesMeta);
router.get("/stats", getCourseStats);

router.get("/:id/similar", getSimilarCourses);
router.get("/:id", getCourseById);
router.post("/", createCourse);

export default router;
