/**
 * Fetch list of courses
 * Υποστηρίζει search, filters και pagination μέσω query params
 */
import { http } from "./http";

// GET /courses (search + filters + pagination)
export async function fetchCourses(params) {
  const res = await http.get("/courses", { params });
  return res.data; // { data, pagination }
}

// GET /courses/:id
export async function fetchCourseById(id) {
  const res = await http.get(`/courses/${id}`);
  return res.data; // course object (formatted)
}

// GET /courses/:id/similar?limit=10
export async function fetchSimilarCourses(id, limit = 10) {
  const res = await http.get(`/courses/${id}/similar`, { params: { limit } });
  // backend returns: { data: [...], pagination: {...} }
  return res.data?.data ?? [];
}

// GET /courses/meta
export async function fetchCoursesMeta() {
  const res = await http.get("/courses/meta");
  return res.data; // { languages, levels, sources, categories }
}

// GET /courses/stats
export async function fetchCourseStats() {
  const res = await http.get("/courses/stats");
  return res.data; // { total, bySource, byLanguage, byLevel, topKeywords }
}