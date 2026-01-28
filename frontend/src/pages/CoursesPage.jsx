/**
  Σελίδα λίστας μαθημάτων.
  Διαχειρίζεται search, filters και pagination
  Καλεί το backend endpoint GET /courses
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCourses, fetchCoursesMeta } from "../api/courses";

function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Meta για dropdowns
  const [meta, setMeta] = useState({
    languages: [],
    levels: [],
    sources: [],
    categories: [],
  });
  const [metaLoading, setMetaLoading] = useState(true);

  // Search και Filters
  const [q, setQ] = useState("");
  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");

  // Pagination 
  const [page, setPage] = useState(1);

  // Load meta once
  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      setMetaLoading(true);
      try {
        const m = await fetchCoursesMeta();
        if (!cancelled) setMeta(m);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build query params
  const params = useMemo(() => {
    const p = { page, limit: 20 };

    if (q.trim()) p.q = q.trim();
    if (language) p.language = language;
    if (level) p.level = level;
    if (source) p.source = source;
    if (category) p.category = category;

    return p;
  }, [q, language, level, source, category, page]);

  // Load courses when params change
  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchCourses(params);
        if (cancelled) return;

        setCourses(result.data ?? []);
        setPagination(result.pagination ?? { page: 1, pageSize: 20, total: 0 });
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load courses. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCourses();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const totalPages = Math.max(1, Math.ceil((pagination.total ?? 0) / (pagination.pageSize ?? 20)));

  function clearAll() {
    setQ("");
    setLanguage("");
    setLevel("");
    setSource("");
    setCategory("");
    setPage(1);
  }

  // Όταν αλλάζει φίλτρο πήγαινε page 1
  function setFilter(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div>
      <h2>Courses</h2>

      {/* Search */}
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search by title / description / keywords..."
          value={q}
          onChange={(e) => setFilter(setQ)(e.target.value)}
          style={{ padding: "0.5rem", width: "100%", maxWidth: "420px" }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <select value={language} onChange={(e) => setFilter(setLanguage)(e.target.value)} style={{ padding: "0.5rem" }}>
          <option value="">All languages</option>
          {meta.languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select value={level} onChange={(e) => setFilter(setLevel)(e.target.value)} style={{ padding: "0.5rem" }}>
          <option value="">All levels</option>
          {meta.levels.map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>

        <select value={source} onChange={(e) => setFilter(setSource)(e.target.value)} style={{ padding: "0.5rem" }}>
          <option value="">All repositories</option>
          {meta.sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Category (keywords) */}
        <select
          value={category}
          onChange={(e) => setFilter(setCategory)(e.target.value)}
          style={{ padding: "0.5rem", minWidth: 220 }}
          disabled={metaLoading}
        >
          <option value="">All categories</option>
          {meta.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button onClick={clearAll} style={{ padding: "0.5rem 0.75rem" }}>
          Clear
        </button>
      </div>

      {/* Status */}
      {loading && <p>Loading courses...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!loading && !error && courses.length === 0 && <p>No courses found.</p>}

      {/* List */}
      {!loading && !error && courses.length > 0 && (
        <>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {courses.map((course) => (
              <li
                key={course.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "1rem",
                  marginBottom: "0.75rem",
                  background: "#fff",
                }}
              >
                <h3 style={{ marginTop: 0 }}>{course.title}</h3>

                {course.shortDescription && <p style={{ marginBottom: "0.5rem" }}>{course.shortDescription}</p>}

                <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  <strong>Language:</strong> {course.language} {" | "}
                  <strong>Level:</strong> {course.level} {" | "}
                  <strong>Source:</strong> {course.source?.name ?? "unknown"}
                </p>

                <Link to={`/courses/${course.id}`}>View details</Link>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Prev
            </button>
            <span>
              Page {page} / {totalPages} (total: {pagination.total})
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default CoursesPage;
