import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Walk up from __dirname until we find the directory that contains
 * package.json — that's the real project root regardless of whether
 * we're running from server/ (dev) or dist/server/ (prod).
 */
function findProjectRoot(start: string): string {
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

const projectRoot = findProjectRoot(__dirname);

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
  booksDir: path.resolve(
    projectRoot,
    process.env.LIBRARY_ROOT || "library",
    "books"
  ),
  workbenchDir: path.resolve(
    projectRoot,
    process.env.LIBRARY_ROOT || "library",
    "workbench"
  ),
  dbPath: path.resolve(projectRoot, process.env.DB_PATH || "data/library.db"),
  pythonPath: process.env.PYTHON_PATH || "python",
  academicScriptPath: path.resolve(
    projectRoot,
    "scripts",
    "extract_academic.py"
  ),
  pdfChapterScriptPath: path.resolve(
    projectRoot,
    "scripts",
    "pdf_chapter_detect.py"
  ),
  chunkWordTarget: Number(process.env.CHUNK_WORD_TARGET) || 600,
  academicTimeoutMs: Number(process.env.ACADEMIC_TIMEOUT_MS) || 120_000,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  ttsCacheDir: path.resolve(
    projectRoot,
    process.env.TTS_CACHE_DIR || "library/tts"
  ),
  ttsScriptPath: path.resolve(
    projectRoot,
    "scripts",
    "synthesize_tts.py"
  ),
  ttsTimeoutMs: Number(process.env.TTS_TIMEOUT_MS) || 300_000,
};
