import { Router } from "express";
import {
  getCourses,
  getCourseById,
  getCoursesMeta,
  getSimilarCourses,
} from "../controllers/coursesController.js";

const router = Router();

router.get("/", getCourses);
router.get("/meta", getCoursesMeta);

// ✅ αυτό ΠΡΙΝ από το "/:id"
router.get("/:id/similar", getSimilarCourses);

router.get("/:id", getCourseById);

export default router;
