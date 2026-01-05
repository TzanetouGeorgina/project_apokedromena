// src/app.js
import express from "express";
import cors from "cors";
import coursesRouter from "./routes/courses.js";
import healthRouter from "./routes/health.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/health", healthRouter);
app.use("/courses", coursesRouter);

export default app;
