import { Router } from "express";
import { syncSource } from "../controllers/syncController.js";

const router = Router();
router.post("/:source", syncSource);


export default router;
