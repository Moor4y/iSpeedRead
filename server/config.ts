import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

export const config = {
  port: Number(process.env.PORT) || 5000,
  host: process.env.HOST || "0.0.0.0",
  libraryRoot: path.resolve(
    projectRoot,
    process.env.LIBRARY_ROOT || "library"
  ),
  uploadsDir: path.resolve(
    projectRoot,
    process.env.LIBRARY_ROOT || "library",
    "uploads"
  ),
  dbPath: path.resolve(projectRoot, process.env.DB_PATH || "data/library.db"),
  pythonPath: process.env.PYTHON_PATH || "python",
  academicScriptPath: path.resolve(
    projectRoot,
    "scripts",
    "extract_academic.py"
  ),
  chunkWordTarget: Number(process.env.CHUNK_WORD_TARGET) || 600,
  academicTimeoutMs: Number(process.env.ACADEMIC_TIMEOUT_MS) || 120_000,
  corsOrigin: process.env.CORS_ORIGIN || "*",
};
