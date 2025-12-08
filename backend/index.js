// backend/index.js
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.json({ message: "Backend ok (Docker)" });
});

app.listen(3000, () => {
  console.log("Backend listening on port 3000");
});
