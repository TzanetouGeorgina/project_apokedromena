// Γινεται το import των script
// Ο importer τρέχει σε ξεχωριστό Node process (spawn) ώστε να μην μπλοκάρει το API να απομονώνονται σφάλματα
// και να μπορούμε να επιστρέψουμε logs 
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const SCRIPTS = {
  udemy: path.join(__dirname, "..", "..", "scripts", "importCourse_info.js"),
  coursera: path.join(__dirname, "..", "..", "scripts", "importCoursera.js"),
};

export async function syncSource(req, res) {
  const { source } = req.params;
  
   // normalize σε lowercase για ασφάλεια
  const script = SCRIPTS[source?.toLowerCase()];
  if (!script) return res.status(400).json({ error: "Unknown source" });

  const child = spawn("node", [script], { stdio: ["ignore", "pipe", "pipe"] });

   // Συλλέγουμε stdout/stderr σε strings για να τα επιστρέψουμε στο response
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d.toString()));
  child.stderr.on("data", (d) => (err += d.toString()));

    // Όταν κλείσει το child process απαντάμε στον client
  child.on("close", (code) => {
    if (code === 0) return res.json({ ok: true, output: out });
    return res.status(500).json({ ok: false, code, error: err || out });
  });
}
