import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// map source -> script
const SCRIPTS = {
  udemy: path.join(__dirname, "..", "..", "scripts", "importCourse_info.js"),
  coursera: path.join(__dirname, "..", "..", "scripts", "importCoursera.js"),
};

export async function syncSource(req, res) {
  const { source } = req.params;
  const script = SCRIPTS[source?.toLowerCase()];
  if (!script) return res.status(400).json({ error: "Unknown source" });

  const child = spawn("node", [script], { stdio: ["ignore", "pipe", "pipe"] });

  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d.toString()));
  child.stderr.on("data", (d) => (err += d.toString()));

  child.on("close", (code) => {
    if (code === 0) return res.json({ ok: true, output: out });
    return res.status(500).json({ ok: false, code, error: err || out });
  });
}
