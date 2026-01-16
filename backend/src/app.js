// src/app.js
import express from "express";
import cors from "cors";
import coursesRouter from "./routes/courses.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/courses", coursesRouter);

export default app;
