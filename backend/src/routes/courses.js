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

// GET /courses list και search (q) και για  filters και pagination
router.get("/", getCourses);

// GET /courses/meta - επιστρέφει distinct values για dropdown filters 
router.get("/meta", getCoursesMeta);

// GET /courses/stats για βασικα analytics 
router.get("/stats", getCourseStats);

// GET /courses/:id/similar- recommendations από Spark
router.get("/:id/similar", getSimilarCourses);

// GET /courses/:id - επιστρέφει ένα course by Mongo ObjectId
router.get("/:id", getCourseById);

// POST /courses- dev endpoint για γρήγορο τεστ insert 
router.post("/", createCourse);

export default router;
