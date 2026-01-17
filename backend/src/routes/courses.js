import { Router } from "express";
import {
  getCourses,
  getCourseById,
  createCourse,
  getCoursesMeta,
} from "../controllers/coursesController.js";

const router = Router();

router.get("/", getCourses);

// ✅ ΠΡΙΝ το "/:id"
router.get("/meta", getCoursesMeta);

router.get("/:id", getCourseById);

// Προσωρινά, για dev
router.post("/", createCourse);

export default router;
