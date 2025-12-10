import { Router } from "express";
import {
  getCourses,
  getCourseById,
  createCourse
} from "../controllers/coursesController.js";

const router = Router();

router.get("/", getCourses);
router.get("/:id", getCourseById);

// Προσωρινά, για dev (μπορείς να το αφαιρέσεις μετά)
router.post("/", createCourse);

export default router;
