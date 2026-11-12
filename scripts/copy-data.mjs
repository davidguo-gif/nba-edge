import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Copy nbadata.js -> nbadata.json
const src = path.join(root, "..", "nba-edge-old", "nbadata.js");
const dst = path.join(root, "public", "nbadata.json");

if (fs.existsSync(src)) {
  const raw = fs.readFileSync(src, "utf-8");
  const json = raw.replace(/^window\.NBA_DATA\s*=\s*/, "").replace(/;\s*$/, "");
  fs.writeFileSync(dst, json);
  console.log("Copied nbadata.json");
}