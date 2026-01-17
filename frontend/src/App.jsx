import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import CoursesPage from "./pages/CoursesPage";
import CourseDetailsPage from "./pages/CourseDetailsPage";

function App() {
  return (
    <Router>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem" }}>
        <header style={{ marginBottom: "1.5rem" }}>
          <h1>Open Courses Aggregator</h1>

          <nav>
            <Link to="/">Courses</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<CoursesPage />} />
          <Route path="/courses/:id" element={<CourseDetailsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
