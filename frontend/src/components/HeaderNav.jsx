// src/components/HeaderNav.jsx
/**
  Header navigation 
  Παρέχει links προς βασικές σελίδες
  NavLink χρησιμοποιείται για active styling
 */
import { useNavigate } from "react-router-dom";

export default function HeaderNav() {
  const navigate = useNavigate();

  return (
    <nav style={{ display: "flex", gap: "1rem" }}>
      <button
        type="button"
        onClick={() => navigate("/")}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "#2563eb",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        Courses
      </button>
    </nav>
  );
}
