import mongoose from "mongoose";

const { Schema } = mongoose;

const SourceSchema = new Schema(
  {
    name: { type: String, required: true },     // π.χ. Coursera, Udemy
    url: { type: String },                      // homepage του provider
    courseId: { type: String },                 // id στο original repo
  },
  { _id: false }
);

const CourseSchema = new Schema(
  {
    title: { type: String, required: true },
    shortDescription: { type: String },
    fullDescription: { type: String },

    language: { type: String, index: true },    // "en", "el", κτλ
    level: { type: String, index: true },       // "beginner", "intermediate", ...

    categories: [{ type: String, index: true }],
    keywords: [{ type: String, index: true }],

    durationHours: { type: Number },
    enrollmentUrl: { type: String },            // link για εγγραφή

    source: { type: SourceSchema, required: true },

    // Από το αρχικό repo (πότε ενημερώθηκε εκεί)
    lastUpdated: { type: Date },

    // Εμείς πότε το φτιάξαμε / το αλλάξαμε στη δική μας DB
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" }
  }
);

// Index για text search (τίτλος + περιγραφές + keywords)
CourseSchema.index({
  title: "text",
  shortDescription: "text",
  fullDescription: "text",
  keywords: "text"
});

const Course = mongoose.model("Course", CourseSchema);

export default Course;
