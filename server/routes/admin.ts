import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  createBookVersion,
  createWorkbenchItem,
  deleteBook,
  deleteWorkbenchItem,
  getBookById,
  getWorkbenchItem,
  insertBookWithChunks,
  listBookVersions,
  listWorkbenchItems,
  markWorkbenchError,
  markWorkbenchPromoted,
  updateWorkbenchAfterConvert,
} from "../db/client.js";
import { parsePdfBasic } from "../services/parser/pdf.js";
import type { ParseLangHint } from "../services/parser/index.js";
import type { ParsedChunk } from "../types/book.js";
import type { AdminLang } from "../types/admin.js";
import { detectAdminLangFromText } from "../services/lang.js";
import {
  chunksToMarkdown,
  deleteBookDir,
  deleteWorkbenchDir,
  ensureWorkbenchDir,
  generateBookId,
  getBookDir,
  getWorkbenchDir,
  saveBookVersionSnapshot,
  writeBookFiles,
  writeWorkbenchFiles,
} from "../services/storage.js";

interface AdminUploadedFile extends Express.Multer.File {
  workbenchId?: string;
}

function parseLang(value: unknown): ParseLangHint {
  if (value === "zh") return "zh";
  if (value === "en") return "en";
  return "auto";
}

function resolveLangFromChunks(chunks: ParsedChunk[], hint: ParseLangHint): AdminLang {
  if (hint !== "auto") return hint;
  return detectAdminLangFromText(chunks.map((chunk) => chunk.text).join("\n"));
}

function parseStrictOcrCleanup(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function getWorkbenchPdfPath(itemId: string): string {
  return path.join(getWorkbenchDir(itemId), "source.pdf");
}

function timestampLabel(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

ensureWorkbenchDir();

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const uploaded = file as AdminUploadedFile;
    const id = generateBookId();
    uploaded.workbenchId = id;
    const dir = getWorkbenchDir(id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, _file, cb) => {
    cb(null, "source.pdf");
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      path.extname(file.originalname).toLowerCase() === ".pdf" ||
      file.mimetype === "application/pdf";
    if (!isPdf) {
      cb(new Error("Admin upload accepts PDF files only"));
      return;
    }
    cb(null, true);
  },
});

export const adminRouter = Router();

adminRouter.get("/workbench", (_req, res) => {
  res.json(listWorkbenchItems());
});

adminRouter.post("/upload", upload.array("file", 200), (req, res) => {
  const files = (req.files as AdminUploadedFile[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: "No file uploaded. Use field name 'file'." });
    return;
  }

  const lang = parseLang(req.body?.lang);
  const created = files.map((file) => {
    const itemId = file.workbenchId;
    if (!itemId) {
      throw new Error("Workbench upload metadata missing");
    }
    return createWorkbenchItem({
      id: itemId,
      originalFilename: file.originalname,
      lang: lang === "auto" ? "en" : lang,
    });
  });

  if (created.length === 1) {
    res.status(201).json(created[0]);
    return;
  }

  res.status(201).json({
    results: created,
    errors: [],
  });
});

adminRouter.post("/workbench/:id/convert", async (req, res) => {
  const { id } = req.params;
  const item = getWorkbenchItem(id);
  if (!item) {
    res.status(404).json({ error: "Workbench item not found" });
    return;
  }

  const pdfPath = getWorkbenchPdfPath(id);
  if (!fs.existsSync(pdfPath)) {
    markWorkbenchError(id, "Missing temporary PDF file");
    res.status(422).json({ error: "Missing temporary PDF file" });
    return;
  }

  const langHint = parseLang(req.body?.lang ?? item.lang);
  const strictOcrCleanup = parseStrictOcrCleanup(req.body?.strictOcrCleanup);

  try {
    const parsed = await parsePdfBasic(pdfPath, item.originalFilename, langHint, {
      strictOcrCleanup,
    });
    const resolvedLang = resolveLangFromChunks(parsed.chunks, langHint);
    const markdown = chunksToMarkdown(parsed.title, parsed.author, parsed.chunks);
    const files = writeWorkbenchFiles(id, markdown, parsed.chunks);
    updateWorkbenchAfterConvert({
      id,
      lang: resolvedLang,
      title: parsed.title,
      author: parsed.author,
      markdownPath: files.markdownPath,
      chunksPath: files.chunksPath,
      status: "converted",
      errorMessage: null,
    });

    const updated = getWorkbenchItem(id);
    res.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to convert PDF to markdown";
    markWorkbenchError(id, message);
    res.status(422).json({ error: message });
  }
});

adminRouter.get("/workbench/:id/preview", (req, res) => {
  const { id } = req.params;
  const item = getWorkbenchItem(id);
  if (!item) {
    res.status(404).json({ error: "Workbench item not found" });
    return;
  }
  if (!item.markdownPath || !fs.existsSync(item.markdownPath)) {
    res.status(404).json({ error: "Converted markdown preview not available" });
    return;
  }

  const markdown = fs.readFileSync(item.markdownPath, "utf-8");
  res.json({
    item,
    markdown,
  });
});

adminRouter.post("/workbench/:id/promote", (req, res) => {
  const { id } = req.params;
  const item = getWorkbenchItem(id);
  if (!item) {
    res.status(404).json({ error: "Workbench item not found" });
    return;
  }
  if (item.status !== "converted") {
    res.status(409).json({ error: "Only converted items can be promoted" });
    return;
  }
  if (!item.markdownPath || !item.chunksPath) {
    res.status(422).json({ error: "Converted files are missing" });
    return;
  }
  if (!fs.existsSync(item.markdownPath) || !fs.existsSync(item.chunksPath)) {
    res.status(422).json({ error: "Converted files are missing on disk" });
    return;
  }

  const chunks = JSON.parse(
    fs.readFileSync(item.chunksPath, "utf-8")
  ) as ParsedChunk[];
  const markdown = fs.readFileSync(item.markdownPath, "utf-8");
  const bookId = generateBookId();

  const title = item.title?.trim() || path.parse(item.originalFilename).name;
  const author = item.author?.trim() || "Unknown Author";

  writeBookFiles(bookId, markdown, chunks);
  insertBookWithChunks({
    id: bookId,
    title,
    author,
    sourceFilename: item.originalFilename,
    sourceType: "pdf",
    chunks,
  });

  markWorkbenchPromoted({ id, bookId });
  deleteWorkbenchDir(id);

  res.status(201).json({
    promoted: true,
    bookId,
    title,
    author,
    totalChunks: chunks.length,
  });
});

adminRouter.delete("/workbench/:id", (req, res) => {
  const { id } = req.params;
  const item = getWorkbenchItem(id);
  if (!item) {
    res.status(404).json({ error: "Workbench item not found" });
    return;
  }

  deleteWorkbenchDir(id);
  deleteWorkbenchItem(id);
  res.json({ deleted: true, id });
});

adminRouter.get("/books/:id/versions", (req, res) => {
  const book = getBookById(req.params.id);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  res.json(listBookVersions(book.id));
});

adminRouter.post("/books/:id/versions", (req, res) => {
  const book = getBookById(req.params.id);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const bookDir = getBookDir(book.id);
  const sourceMdPath = path.join(bookDir, "source.md");
  const chunksPath = path.join(bookDir, "chunks.json");
  if (!fs.existsSync(sourceMdPath) || !fs.existsSync(chunksPath)) {
    res.status(422).json({ error: "Book file tree is incomplete" });
    return;
  }

  const snapshot = timestampLabel();
  const labelRaw = typeof req.body?.label === "string" ? req.body.label : "";
  const label = labelRaw.trim() || `Snapshot ${snapshot}`;
  const langValue = req.body?.lang;
  const langHint = langValue === undefined ? null : parseLang(langValue);
  const lang: AdminLang | null =
    langHint === null || langHint === "auto" ? null : langHint;
  const saved = saveBookVersionSnapshot(book.id, sourceMdPath, chunksPath, snapshot);
  const version = createBookVersion({
    id: generateBookId(),
    bookId: book.id,
    label,
    sourceMdPath: saved.sourceMdPath,
    chunksPath: saved.chunksPath,
    lang,
  });
  res.status(201).json(version);
});

adminRouter.delete("/books/:id", (req, res) => {
  const { id } = req.params;
  const book = getBookById(id);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  try {
    deleteBookDir(id);
  } catch (err) {
    console.warn(`Could not delete book directory for ${id}:`, err);
  }
  const deleted = deleteBook(id);
  if (!deleted) {
    res.status(500).json({ error: "Failed to delete book from database" });
    return;
  }
  res.json({ deleted: true, bookId: id });
});

adminRouter.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err.message.includes("PDF files only")) {
      res.status(400).json({ error: err.message });
      return;
    }
    if ((err as { code?: string }).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File too large (max 100MB)" });
      return;
    }
    res.status(500).json({ error: "Admin operation failed" });
  }
);
