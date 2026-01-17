import { http } from "./http";

export async function fetchCourses(params) {
  const res = await http.get("/courses", { params });
  return res.data; // { data, pagination }
}

export async function fetchCourseById(id) {
  const res = await http.get(`/courses/${id}`);
  return res.data; // course object
}

export async function fetchCoursesMeta() {
  const res = await http.get("/courses/meta");
  return res.data; // { languages, levels, sources, categories }
}
