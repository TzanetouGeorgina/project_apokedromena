/**
  Αυτό το collection το γεμίζει το Spark job.
  Για κάθε courseId  similar_ids: λίστα από ObjectId strings που είναι similar
                     scores: αντίστοιχες ομοιότητες (π.χ. cosine similarity)
 */
import mongoose from "mongoose";

const CourseSimilaritySchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true, index: true },
    similar_ids: { type: [String], default: [] },
    scores: { type: [Number], default: [] },
  },
  { collection: "course_similarity" } 
);

CourseSimilaritySchema.index({ courseId: 1 }, { unique: true });

export default mongoose.model("CourseSimilarity", CourseSimilaritySchema);
