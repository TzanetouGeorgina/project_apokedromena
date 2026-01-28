// src/app.js
import express from "express";
import cors from "cors";

// Router για /courses endpoints
import coursesRouter from "./routes/courses.js";

// Router για /sync endpoints
import syncRouter from "./routes/sync.js";   
const app = express();

//Middleware: CORS-  Επιτρέπει στο frontend να καλεί το backend
app.use(cors());

//Middleware: JSON body parser- Χωρίς αυτό, τα req.body σε POST/PUT είναι undefine
app.use(express.json());

app.use("/courses", coursesRouter);
app.use("/sync", syncRouter);               

export default app;
