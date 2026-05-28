import fs from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import type { ParsedChunk } from "../types/book.js";

// ---------------------------------------------------------------------------
// Directory helpers
// ---------------------------------------------------------------------------

export function ensureUploadDir(): void {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

export function ensureBooksDir(): void {
  fs.mkdirSync(config.booksDir, { recursive: true });
}

export function ensureWorkbenchDir(): void {
  fs.mkdirSync(config.workbenchDir, { recursive: true });
}

/** Returns the per-book directory path: <booksDir>/<bookId> */
export function getBookDir(bookId: string): string {
  return path.join(config.booksDir, bookId);
}

/** Returns workbench directory: <workbenchDir>/<itemId> */
export function getWorkbenchDir(itemId: string): string {
  return path.join(config.workbenchDir, itemId);
}

/** Returns versions directory for a book: <booksDir>/<bookId>/versions */
export function getBookVersionsDir(bookId: string): string {
  return path.join(getBookDir(bookId), "versions");
}

// ---------------------------------------------------------------------------
// ID / filename helpers
// ---------------------------------------------------------------------------

export function generateBookId(): string {
  return uuidv4();
}

export function filenameStem(filename: string): string {
  return path.basename(filename, path.extname(filename));
}

export function getSourceType(
  filename: string,
  mimetype?: string
): "epub" | "pdf" | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".epub" || mimetype === "application/epub+zip") {
    return "epub";
  }
  if (ext === ".pdf" || mimetype === "application/pdf") {
    return "pdf";
  }
  return null;
}

export function isAcademicFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return lower === "true" || lower === "1" || lower === "yes";
  }
  return false;
}

// ---------------------------------------------------------------------------
// Persistent file-tree writers / readers
// ---------------------------------------------------------------------------

/**
 * Write source.md and chunks.json into /library/books/<bookId>/.
 * Creates the directory if it does not exist.
 */
export function writeBookFiles(
  bookId: string,
  markdownText: string,
  chunks: ParsedChunk[]
): void {
  const dir = getBookDir(bookId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "source.md"), markdownText, "utf-8");
  fs.writeFileSync(
    path.join(dir, "chunks.json"),
    JSON.stringify(chunks, null, 2),
    "utf-8"
  );
}

/** Write converted workbench artifacts into /library/workbench/<itemId>/ */
export function writeWorkbenchFiles(
  itemId: string,
  markdownText: string,
  chunks: ParsedChunk[]
): { markdownPath: string; chunksPath: string } {
  const dir = getWorkbenchDir(itemId);
  fs.mkdirSync(dir, { recursive: true });
  const markdownPath = path.join(dir, "converted.md");
  const chunksPath = path.join(dir, "chunks.json");
  fs.writeFileSync(markdownPath, markdownText, "utf-8");
  fs.writeFileSync(chunksPath, JSON.stringify(chunks, null, 2), "utf-8");
  return { markdownPath, chunksPath };
}

export function ensureBookVersionsDir(bookId: string): string {
  const versionsDir = getBookVersionsDir(bookId);
  fs.mkdirSync(versionsDir, { recursive: true });
  return versionsDir;
}

export function saveBookVersionSnapshot(
  bookId: string,
  sourceMdPath: string,
  chunksPath: string,
  snapshotName: string
): { versionDir: string; sourceMdPath: string; chunksPath: string } {
  const versionsDir = ensureBookVersionsDir(bookId);
  const versionDir = path.join(versionsDir, snapshotName);
  fs.mkdirSync(versionDir, { recursive: true });
  const snapshotSource = path.join(versionDir, "source.md");
  const snapshotChunks = path.join(versionDir, "chunks.json");
  fs.copyFileSync(sourceMdPath, snapshotSource);
  fs.copyFileSync(chunksPath, snapshotChunks);
  return {
    versionDir,
    sourceMdPath: snapshotSource,
    chunksPath: snapshotChunks,
  };
}

export function chunksToMarkdown(
  title: string,
  author: string,
  chunks: ParsedChunk[]
): string {
  const header = `# ${title}\n\n**Author:** ${author}\n\n`;
  const body = chunks
    .map((chunk) => {
      const chapterLine = chunk.chapterTitle ? `## ${chunk.chapterTitle}\n\n` : "";
      return `${chapterLine}${chunk.text}`;
    })
    .join("\n\n---\n\n");
  return header + body;
}

/**
 * Read chunks.json from the book directory.
 * Returns null if the file does not exist (e.g. legacy book without file tree).
 */
export function readBookChunks(bookId: string): ParsedChunk[] | null {
  const chunksPath = path.join(getBookDir(bookId), "chunks.json");
  if (!fs.existsSync(chunksPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(chunksPath, "utf-8")) as ParsedChunk[];
  } catch {
    return null;
  }
}

/**
 * Recursively delete the book's directory.
 * No-ops if the directory does not exist.
 */
export function deleteBookDir(bookId: string): void {
  const dir = getBookDir(bookId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function deleteWorkbenchDir(itemId: string): void {
  const dir = getWorkbenchDir(itemId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Misc cleanup
// ---------------------------------------------------------------------------

export function deleteFileIfExists(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // best-effort cleanup
  }
}
