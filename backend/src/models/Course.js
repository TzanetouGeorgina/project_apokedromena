// src/models/Course.js
import mongoose from "mongoose";

const { Schema } = mongoose;

// Βοηθητικός τύπος για υποχρεωτικά text fields με default "unknown"
const REQUIRED_TEXT = {
  type: String,
  required: true,
  trim: true,
  default: "unknown",
};

const CourseSchema = new Schema(
  {
    title: REQUIRED_TEXT,              // Τίτλος
    shortDescription: REQUIRED_TEXT,   // Σύντομη περιγραφή

    keywords: {
      type: [String],
      default: [],
    },

    language: REQUIRED_TEXT,           // Γλώσσα
    level: REQUIRED_TEXT,              // beginner / intermediate / advanced / unknown

    source: {
      name: REQUIRED_TEXT,             // π.χ. "Udemy", "Coursera"
      url: REQUIRED_TEXT,              // URL του μαθήματος στην αρχική πλατφόρμα
    },

    accessLink: REQUIRED_TEXT,         // Link εγγραφής/πρόσβασης

    lastUpdated: {
      type: Date,
      default: null,
    },
      
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);




const Course = mongoose.model("Course", CourseSchema);
export default Course;
