import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function CourseDetailsPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCourse = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await axios.get(`${API_BASE_URL}/courses/${id}`);
        setCourse(response.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load course details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [id]);

  if (loading) {
    return <p>Loading course...</p>;
  }

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

      {course.description && <p>{course.description}</p>}

      <p>
        <strong>Language:</strong> {course.language} <br />
        <strong>Level:</strong> {course.level} <br />
        <strong>Source:</strong>{" "}
        {course.source?.name || course.source || "Unknown"}
        <br />
        {course.enrollUrl && (
          <>
            <strong>Link:</strong>{" "}
            <a href={course.enrollUrl} target="_blank" rel="noreferrer">
              Go to original repository
            </a>
          </>
        )}
      </p>
    </div>
  );
}

export default CourseDetailsPage;