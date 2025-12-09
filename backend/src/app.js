import express from "express";
import cors from "cors";
import morgan from "morgan";

import coursesRouter from "./routes/courses.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// main routes
app.use("/courses", coursesRouter);

export default app;
