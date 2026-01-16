// src/app.js
import express from "express";
import cors from "cors";
import coursesRouter from "./routes/courses.js";
import syncRouter from "./routes/sync.js";   
const app = express();

app.use(cors());
app.use(express.json());

app.use("/courses", coursesRouter);
app.use("/sync", syncRouter);               

export default app;
