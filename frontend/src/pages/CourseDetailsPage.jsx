import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchCourseById } from "../api/courses";

function CourseDetailsPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchCourseById(id);
        if (!cancelled) setCourse(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load course details. Please try again.");
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
        <Link to="/">Back to courses</Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div>
        <p>Course not found.</p>
        <Link to="/">Back to courses</Link>
      </div>
    );
  }

  return (
    <div>
      <p>
        <Link to="/">&larr; Back to courses</Link>
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
    </div>
  );
}

export default CourseDetailsPage;
