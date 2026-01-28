import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";

import app from "../src/app.js";
import Course from "../src/models/Course.js";

async function connectWithRetry(uri, retries = 20, delayMs = 800) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

const TEST_COURSE = {
  title: "Python for Beginners (TEST)",
  shortDescription: "Learn Python programming (TEST)",
  keywords: ["python", "test", "integration"],
  language: "English",
  level: "Beginner Level",
  source: { name: "Test Source", url: "http://example.com" },
  accessLink: "http://example.com/python-test-course",
  lastUpdated: new Date(),
};

let createdId; // ObjectId string

test.before(async () => {
  const uri = process.env.MONGO_URI;
  assert.ok(
    uri,
    "MONGO_URI is not set. Example: mongodb://mongo:27017/courses_db_test"
  );

  await connectWithRetry(uri);

  // cleanup προηγούμενων runs
  await Course.deleteMany({ "source.name": "Test Source" });

  const doc = await Course.create(TEST_COURSE);
  createdId = String(doc._id);
});

test.after(async () => {
  try {
    await Course.deleteMany({ "source.name": "Test Source" });
  } finally {
    await mongoose.connection.close();
  }
});

// ✅ TEST 1: GET /courses returns list + pagination OR list shape
test("GET /courses returns list of courses", async () => {
  const res = await request(app).get("/courses");

  assert.equal(res.statusCode, 200);
  assert.ok(res.body, "Missing response body");

  // Στο δικό σου API συνήθως είναι { data: [...], pagination: {...} }
  // αλλά αν είναι { courses: [...] } το υποστηρίζουμε επίσης.
  const list = res.body.data ?? res.body.courses;
  assert.ok(Array.isArray(list), "Expected response list to be an array");

  // Αν υπάρχει pagination, κάνε βασικό έλεγχο
  if (res.body.pagination) {
    assert.equal(typeof res.body.pagination.total, "number");
  }
});

// ✅ TEST 2: GET /courses/:id returns a course
test("GET /courses/:id returns a course", async () => {
  const res = await request(app).get(`/courses/${createdId}`);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body, "Missing response body");

  // Μερικές υλοποιήσεις επιστρέφουν id, άλλες _id
  const returnedId = res.body.id ?? res.body._id;
  assert.ok(returnedId, "Expected body.id or body._id");
  assert.equal(String(returnedId), createdId);

  assert.equal(res.body.title, TEST_COURSE.title);
  assert.equal(res.body.language, "English");
});

// ✅ TEST 3: GET /courses supports search + filters
test("GET /courses supports q + language filters", async () => {
  const res = await request(app)
    .get("/courses")
    .query({ q: "python", language: "English", limit: 50 });

  assert.equal(res.statusCode, 200);

  const list = res.body.data ?? res.body.courses;
  assert.ok(Array.isArray(list), "Expected response list to be an array");

  const found = list.some(
    (c) => c && c.title === TEST_COURSE.title && c.language === "English"
  );
  assert.equal(found, true, "Expected to find inserted test course in results");
});

// ✅ TEST 4: GET /courses/stats returns analytics (requires your endpoint)
test("GET /courses/stats returns analytics fields", async () => {
  const res = await request(app).get("/courses/stats");

  assert.equal(res.statusCode, 200);
  assert.ok(res.body, "Missing response body");

  assert.equal(typeof res.body.total, "number");
  assert.ok(Array.isArray(res.body.bySource), "Expected bySource array");
  assert.ok(Array.isArray(res.body.byLanguage), "Expected byLanguage array");
});
