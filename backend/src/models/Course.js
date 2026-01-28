// src/models/Course.js
import mongoose from "mongoose";

const { Schema } = mongoose;

//Helper σχημα για  required string, trim καιγια  default "unknown"

const REQUIRED_TEXT = {
  type: String,
  required: true,
  trim: true,
  default: "unknown",
};

// Το εννιαίο μας σχήμα
const CourseSchema = new Schema(
  {
    title: REQUIRED_TEXT,
    shortDescription: REQUIRED_TEXT,

    keywords: { type: [String], default: [] },

    language: REQUIRED_TEXT,
    level: REQUIRED_TEXT,

    source: {
      name: REQUIRED_TEXT,
      url: REQUIRED_TEXT,
    },

    accessLink: REQUIRED_TEXT,

    // χρήσιμο για future delta sync / debugging
    externalId: { type: String, default: "" },

    lastUpdated: { type: Date, default: null },
  },
  { timestamps: true }
);

// Text search για /courses?q=
CourseSchema.index({
  title: "text",
  shortDescription: "text",
  keywords: "text",
});

// Το ίδιο μάθημα (ίδιο accessLink) να μην γράφεται 2 φορές από την ίδια πηγη
CourseSchema.index({ "source.name": 1, accessLink: 1 }, { unique: true });

// Performance indexes για φίλτρα/sort
CourseSchema.index({ language: 1 });
CourseSchema.index({ level: 1 });
CourseSchema.index({ "source.name": 1 });
CourseSchema.index({ lastUpdated: -1 });

const Course = mongoose.model("Course", CourseSchema);
export default Course;
