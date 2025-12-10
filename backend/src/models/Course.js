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
    // 🔹 Βασικά υποχρεωτικά (όπως ζητάει η εκφώνηση)

    title: REQUIRED_TEXT,              // Τίτλος
    shortDescription: REQUIRED_TEXT,   // Σύντομη περιγραφή

    // Λέξεις-κλειδιά / θεματική κατηγορία
    // Μπορεί να είναι tags, category, topic, κλπ.
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

    accessLink: REQUIRED_TEXT,         // Link εγγραφής/πρόσβασης (συνήθως ίδιο με source.url)

    // Ημερομηνία τελευταίας ενημέρωσης στο εξωτερικό repository
    lastUpdated: {
      type: Date,
      default: null,                   // θα το δείξεις σαν "Unknown" στο UI αν είναι null
    },

    // 🔹 Προαιρετικά, χρήσιμα για ML / analytics / frontend

    description: {
      type: String,
      trim: true,
      default: "",
    }, // πλήρης περιγραφή (αν υπάρχει)

    category: {
      type: String,
      trim: true,
      default: "",
    },

    subcategory: {
      type: String,
      trim: true,
      default: "",
    },

    // Π.χ. "udemy:12345", "coursera:abcde"
    externalId: {
      type: String,
      trim: true,
      default: "",
    },

    // Μπορείς να βάλεις εδώ extra fields από τα CSV (price, rating, κλπ) αν τα χρειαστείς
    price: {
      type: Number,
      default: null,
    },
    rating: {
      type: Number,
      default: null,
    },
    numReviews: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt από Mongo
  }
);

// 🔍 Index για αναζήτηση σε τίτλο / περιγραφή / keywords
CourseSchema.index({
  title: "text",
  shortDescription: "text",
  keywords: 1,
});

// ΠΡΟΣΟΧΗ: ES module export, ΟΧΙ module.exports
const Course = mongoose.model("Course", CourseSchema);
export default Course;
