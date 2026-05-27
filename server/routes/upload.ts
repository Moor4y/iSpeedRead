import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { insertBookWithChunks } from "../db/client.js";
import { parseBookFile } from "../services/parser/index.js";
import {
  deleteFileIfExists,
  ensureUploadDir,
  generateBookId,
  getSourceType,
  isAcademicFlag,
} from "../services/storage.js";
import type { UploadResponseDto } from "../types/book.js";

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const bookId = generateBookId();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${bookId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const sourceType = getSourceType(file.originalname, file.mimetype);
    if (!sourceType) {
      cb(new Error("Only EPUB and PDF files are supported"));
      return;
    }
    cb(null, true);
  },
});

export const uploadRouter = Router();

uploadRouter.post("/", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded. Use field name 'file'." });
    return;
  }

  const sourceType = getSourceType(file.originalname, file.mimetype);
  if (!sourceType) {
    deleteFileIfExists(file.path);
    res.status(400).json({ error: "Only EPUB and PDF files are supported" });
    return;
  }

  const academic = isAcademicFlag(req.body?.academic);
  const bookId = path.basename(file.filename, path.extname(file.filename));

  try {
    const parsed = await parseBookFile(
      file.path,
      file.originalname,
      sourceType,
      academic
    );

    insertBookWithChunks({
      id: bookId,
      title: parsed.title,
      author: parsed.author,
      sourceFilename: file.originalname,
      sourceType,
      chunks: parsed.chunks,
    });

    const response: UploadResponseDto = {
      bookId,
      title: parsed.title,
      author: parsed.author,
      totalChunks: parsed.chunks.length,
    };

    res.status(201).json(response);
  } catch (err) {
    deleteFileIfExists(file.path);
    const message =
      err instanceof Error ? err.message : "Failed to parse uploaded file";
    console.error("Upload parse error:", err);
    res.status(422).json({ error: message });
  }
});
