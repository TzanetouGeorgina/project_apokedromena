import { Router } from "express";
import {
  getCourses,
  getCourseById,
  getSimilarCourses,
  createCourse,
  exportCourses,
} from "../controllers/coursesController.js";

const router = Router();

router.get("/", getCourses);

router.get("/export", exportCourses);

router.get("/:id/similar", getSimilarCourses);

router.get("/:id", getCourseById);


// Προσωρινά, για dev 
router.post("/", createCourse);

export default router;
