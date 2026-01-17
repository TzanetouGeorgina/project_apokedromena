import mongoose from "mongoose";

const CourseSimilaritySchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true, index: true },
    similar_ids: { type: [String], default: [] },
    scores: { type: [Number], default: [] },
  },
  { collection: "course_similarity" } // IMPORTANT: ίδιο όνομα με αυτό που γράφει το Spark
);

CourseSimilaritySchema.index({ courseId: 1 }, { unique: true });

export default mongoose.model("CourseSimilarity", CourseSimilaritySchema);
