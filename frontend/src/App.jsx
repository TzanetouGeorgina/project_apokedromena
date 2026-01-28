/**
 Ορίζει το layout 
 Ορίζει τα routes της εφαρμογής
 */
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import CoursesPage from "./pages/CoursesPage";
import CourseDetailsPage from "./pages/CourseDetailsPage";
import AnalyticsPage from "./pages/AnalyticsPage"; 

function App() {
  return (
    <Router>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem" }}>
        <header style={{ marginBottom: "1.5rem" }}>
          <h1>Open Courses Aggregator</h1>

          <nav style={{ display: "flex", gap: "1rem" }}>
            <Link to="/">Courses</Link>
            <Link to="/analytics">Analytics</Link> 
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<CoursesPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} /> 
          <Route path="/courses/:id" element={<CourseDetailsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

