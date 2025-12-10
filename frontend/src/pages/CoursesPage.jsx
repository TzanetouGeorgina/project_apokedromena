import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      setError("");

      try {
        const params = {};
        if (search.trim()) {
          params.search = search.trim();
        }

        const response = await axios.get(`${API_BASE_URL}/courses`, {
          params,
        });

        setCourses(response.data || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load courses. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [search]);

  return (
    <div>
      <h2>Courses</h2>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search by title or keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "0.5rem", width: "100%", maxWidth: "400px" }}
        />
      </div>

      {loading && <p>Loading courses...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && courses.length === 0 && (
        <p>No courses found. Try a different search.</p>
      )}

      {!loading && !error && courses.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {courses.map((course) => (
            <li
              key={course._id || course.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "0.75rem",
                background: "#fff",
              }}
            >
              <h3>{course.title}</h3>

              {course.description && (
                <p style={{ marginBottom: "0.5rem" }}>{course.description}</p>
              )}

              <p style={{ marginBottom: "0.5rem" }}>
                <strong>Language:</strong> {course.language}{" "}
                | <strong>Level:</strong> {course.level}
              </p>

              <Link to={`/courses/${course._id || course.id}`}>
                View details
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CoursesPage;