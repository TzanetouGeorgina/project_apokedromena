import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCourseById, fetchSimilarCourses } from "../api/courses";

function CourseDetailsPage() {
  const { id } = useParams();

  const [course, setCourse] = useState(null);
  const [similar, setSimilar] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      setSimilar([]);
      setSimilarError("");

      try {
        const c = await fetchCourseById(id);
        if (cancelled) return;

        setCourse(c);

        // load similar after course loads
        setSimilarLoading(true);
        try {
          const s = await fetchSimilarCourses(id, 10);
          if (!cancelled) setSimilar(s.data ?? []);
        } catch (e) {
          console.error(e);
          if (!cancelled) setSimilarError("Failed to load similar courses.");
        } finally {
          if (!cancelled) setSimilarLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load course details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p>Loading course...</p>;

  if (error) {
    return (
      <div>
        <p style={{ color: "red" }}>{error}</p>
        <Link to="/">← Back to courses</Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div>
        <p>Course not found.</p>
        <Link to="/">← Back to courses</Link>
      </div>
    );
  }

  return (
    <div>
      <p>
        <Link to="/">← Back to courses</Link>
      </p>

      <h2>{course.title}</h2>

      {course.shortDescription && <p>{course.shortDescription}</p>}

      {Array.isArray(course.keywords) && course.keywords.length > 0 && (
        <p>
          <strong>Keywords:</strong> {course.keywords.join(", ")}
        </p>
      )}

      <p>
        <strong>Language:</strong> {course.language} <br />
        <strong>Level:</strong> {course.level} <br />
        <strong>Source:</strong> {course.source?.name ?? "unknown"} <br />
        <strong>Last updated:</strong> {course.lastUpdated}
      </p>

      {course.accessLink && course.accessLink !== "unknown" && (
        <p>
          <a href={course.accessLink} target="_blank" rel="noreferrer">
            Go to original repository
          </a>
        </p>
      )}

      <hr />

      <h3>Similar courses</h3>

      {similarLoading && <p>Loading similar courses...</p>}
      {similarError && <p style={{ color: "red" }}>{similarError}</p>}

      {!similarLoading && !similarError && similar.length === 0 && (
        <p style={{ opacity: 0.8 }}>No similar courses found.</p>
      )}

      {!similarLoading && !similarError && similar.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {similar.map((c) => (
            <li
              key={c.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "0.75rem",
                marginBottom: "0.6rem",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div>
                  <strong>{c.title}</strong>
                  {c.shortDescription && c.shortDescription !== "unknown" && (
                    <div style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>{c.shortDescription}</div>
                  )}
                  <div style={{ fontSize: "0.85rem", marginTop: "0.35rem", opacity: 0.9 }}>
                    {c.language} | {c.level} | {c.source?.name ?? "unknown"}
                  </div>
                </div>

                <div style={{ whiteSpace: "nowrap" }}>
                  <Link to={`/courses/${c.id}`}>Open</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CourseDetailsPage;
