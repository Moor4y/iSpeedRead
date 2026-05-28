import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { insertBookWithChunks } from "../db/client.js";
import { parseBookFile } from "../services/parser/index.js";
import type { ParseLangHint } from "../services/parser/index.js";
import {
  chunksToMarkdown,
  deleteFileIfExists,
  ensureUploadDir,
  generateBookId,
  getSourceType,
  isAcademicFlag,
  writeBookFiles,
} from "../services/storage.js";
import type { UploadResponseDto } from "../types/book.js";

function parseLang(value: unknown): ParseLangHint {
  if (value === "zh") return "zh";
  if (value === "en") return "en";
  return "auto";
}

ensureUploadDir();

// ---------------------------------------------------------------------------
// Multer — disk storage in the uploads temp dir
// ---------------------------------------------------------------------------

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Embed a fresh UUID in the temp filename so we can reuse it as bookId
    const bookId = generateBookId();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${bookId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per file
  fileFilter: (_req, file, cb) => {
    const sourceType = getSourceType(file.originalname, file.mimetype);
    if (!sourceType) {
      cb(new Error("Only EPUB and PDF files are supported"));
      return;
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Process a single uploaded file: parse → write file tree → insert DB → unlink temp.
 */
async function processUploadedFile(
  file: Express.Multer.File,
  academic: boolean,
  lang: ParseLangHint
): Promise<UploadResponseDto> {
  const sourceType = getSourceType(file.originalname, file.mimetype);
  if (!sourceType) {
    deleteFileIfExists(file.path);
    throw new Error("Only EPUB and PDF files are supported");
  }

  // The UUID was embedded in the temp filename by multer
  const bookId = path.basename(file.filename, path.extname(file.filename));

  try {
    const parsed = await parseBookFile(
      file.path,
      file.originalname,
      sourceType,
      academic,
      lang
    );

    // 1. Write persistent file tree: /library/books/<bookId>/source.md + chunks.json
    const markdown = chunksToMarkdown(parsed.title, parsed.author, parsed.chunks);
    writeBookFiles(bookId, markdown, parsed.chunks);

    // 2. Persist metadata + chunks to SQLite
    insertBookWithChunks({
      id: bookId,
      title: parsed.title,
      author: parsed.author,
      sourceFilename: file.originalname,
      sourceType,
      chunks: parsed.chunks,
    });

    return {
      bookId,
      title: parsed.title,
      author: parsed.author,
      totalChunks: parsed.chunks.length,
    };
  } finally {
    // 3. Always drop the heavy source file from the temp uploads dir
    deleteFileIfExists(file.path);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const uploadRouter = Router();

/**
 * POST /api/upload
 *
 * Accepts one or more EPUB/PDF files via the "file" field (multi-file drop
 * supported). Each file is parsed, written to the persistent file tree, stored
 * in the database, and the original upload is immediately deleted.
 *
 * Single file  → returns UploadResponseDto directly (backwards-compatible).
 * Multiple files → returns { results: UploadResponseDto[], errors: {...}[] }.
 */
uploadRouter.post("/", upload.array("file", 50), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    res.status(400).json({ error: "No file uploaded. Use field name 'file'." });
    return;
  }

  const academic = isAcademicFlag(req.body?.academic);
  const lang = parseLang(req.body?.lang);

  // ── Single-file path (backwards-compatible response shape) ──────────────
  if (files.length === 1) {
    try {
      const result = await processUploadedFile(files[0], academic, lang);
      res.status(201).json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse uploaded file";
      console.error("Upload parse error:", err);
      res.status(422).json({ error: message });
    }
    return;
  }

  // ── Multi-file path ──────────────────────────────────────────────────────
  const results: UploadResponseDto[] = [];
  const errors: { filename: string; error: string }[] = [];

  await Promise.allSettled(
    files.map(async (file) => {
      try {
        const result = await processUploadedFile(file, academic, lang);
        results.push(result);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to parse uploaded file";
        console.error(`Upload parse error [${file.originalname}]:`, err);
        errors.push({ filename: file.originalname, error: message });
      }
    })
  );

  const status = results.length === 0 ? 422 : 201;
  res.status(status).json({ results, errors });
});
