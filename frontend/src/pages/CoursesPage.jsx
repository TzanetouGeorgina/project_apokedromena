import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [keyword, getKeyword] = useState("");

  //νέα δεδομένα
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      setError("");

      try {
        const params = {};

        if (search.trim()) {
          params.search = search.trim();
        }

        if (language) {
            params.language = language;
        }

        if (level) {
            params.level = level;
        }

        if (source) {
            params.source = source;
        }

        if (keyword) {
            params.keyword = keyword;
        }
        //φέρε δεδομένα για το συγεκριμένο id μέσω get request
        const response = await axios.get(`${API_BASE_URL}/courses`, {
          params,
        });
        //φορρτώνει τα δεδομένα που ήρθαν
        setCourses(response.data || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load courses. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [search, language, level, source, keyword]); //για να δουλεύει η αναζήτηση 

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
   
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        marginBottom: "1.5rem",
      }}
    >
     {/* Γλώσσα */}
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        style={{ padding: "0.5rem" }}
      >
        <option value="">All languages</option>
        <option value="en">English</option>
        <option value="el">Greek</option>
      </select>

      {/* Επίπεδο */}
      <select
        value={level}
        onChange={(e) => setLevel(e.target.value)}
        style={{ padding: "0.5rem" }}
      >
        <option value="">All levels</option>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>

      {/* Πηγή */}
      <select
        value={source}
        onChange={(e) => setSource(e.target.value)}
        style={{ padding: "0.5rem" }}
      >
        <option value="">All repositories</option>
        <option value="kaggle">Kaggle</option>
        <option value="coursera">Coursera</option>
      </select>

      {/* Λέξεις-κελιδιά */}
      <input
        type="text"
        placeholder="Keyword / subject..." 
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ padding: "0.5rem" }}
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

               <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  <strong>Language:</strong> {course.language || "N/A"}{" "}
      |           <strong>Level:</strong> {course.level || "N/A"}{" "}
      |           <strong>Source:</strong>{" "}
                 {course.source?.name || course.source || "Unknown"}
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