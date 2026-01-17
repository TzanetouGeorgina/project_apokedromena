import { http } from "./http";

export async function fetchCourses(params) {
  const res = await http.get("/courses", { params });
  return res.data;
}

export async function fetchCourseById(id) {
  const res = await http.get(`/courses/${id}`);
  return res.data;
}

export async function fetchCoursesMeta() {
  const res = await http.get("/courses/meta");
  return res.data;
}

export async function fetchSimilarCourses(id, limit = 10) {
  const res = await http.get(`/courses/${id}/similar`, { params: { limit } });
  return res.data; // { data: [...] }
}
