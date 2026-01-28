/**
  Δημιουργεί το React root
  Τυλίγει όλη την εφαρμογή με BrowserRouter
  ώστε να υποστηρίζονται routes (/courses, /analytics κλπ)
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
