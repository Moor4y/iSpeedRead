import fs from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";

export function ensureUploadDir(): void {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

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

export function deleteFileIfExists(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // best-effort cleanup
  }
}
