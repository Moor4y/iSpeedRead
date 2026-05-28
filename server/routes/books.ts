import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { getBookById, getChunk, listBooks, deleteBook } from "../db/client.js";
import { synthesizeChunkTts } from "../services/tts.js";
import { resolveVoice } from "../services/tts.js";
import { getBookDir, deleteBookDir } from "../services/storage.js";
import type { TtsLang } from "../types/tts.js";

export const booksRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/books
// Scans the DB for metadata and annotates each entry with whether a persistent
// file tree exists on disk (hasFileTree, sourceFile).
// ---------------------------------------------------------------------------
booksRouter.get("/", (_req, res) => {
  const books = listBooks();

  const enriched = books.map((book) => {
    const bookDir = getBookDir(book.bookId);
    const sourceFile = path.join(bookDir, "source.md");
    const chunksFile = path.join(bookDir, "chunks.json");
    const hasFileTree =
      fs.existsSync(sourceFile) && fs.existsSync(chunksFile);

    return {
      ...book,
      hasFileTree,
      ...(hasFileTree ? { sourceFile, chunksFile } : {}),
    };
  });

  res.json(enriched);
});

// ---------------------------------------------------------------------------
// GET /api/books/:id
// ---------------------------------------------------------------------------
booksRouter.get("/:id", (req, res) => {
  const book = getBookById(req.params.id);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const bookDir = getBookDir(book.id);
  const sourceFile = path.join(bookDir, "source.md");
  const chunksFile = path.join(bookDir, "chunks.json");
  const hasFileTree =
    fs.existsSync(sourceFile) && fs.existsSync(chunksFile);

  res.json({
    bookId: book.id,
    title: book.title,
    author: book.author,
    totalChunks: book.total_chunks,
    sourceType: book.source_type,
    createdAt: book.created_at,
    hasFileTree,
    ...(hasFileTree ? { sourceFile, chunksFile } : {}),
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/books/:id
// Removes the DB record (cascades to chunks) and wipes the book directory.
// ---------------------------------------------------------------------------
booksRouter.delete("/:id", (req, res) => {
  const { id } = req.params;

  const book = getBookById(id);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  // Wipe the persistent file tree first (best-effort; DB delete still runs)
  try {
    deleteBookDir(id);
  } catch (err) {
    console.warn(`Could not delete book directory for ${id}:`, err);
  }

  // Remove from DB (ON DELETE CASCADE removes chunks too)
  const deleted = deleteBook(id);
  if (!deleted) {
    res.status(500).json({ error: "Failed to delete book from database" });
    return;
  }

  res.status(200).json({ deleted: true, bookId: id });
});

// ---------------------------------------------------------------------------
// GET /api/books/:id/chunk/:index
// ---------------------------------------------------------------------------
booksRouter.get("/:id/chunk/:index", (req, res) => {
  const bookId = req.params.id;
  const chunkIndex = Number.parseInt(req.params.index, 10);

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    res.status(400).json({ error: "Invalid chunk index" });
    return;
  }

  const book = getBookById(bookId);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  if (chunkIndex >= book.total_chunks) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }

  const chunk = getChunk(bookId, chunkIndex);
  if (!chunk) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }

  res.json(chunk);
});

// ---------------------------------------------------------------------------
// GET /api/books/:id/chunk/:index/tts
// ---------------------------------------------------------------------------
booksRouter.get("/:id/chunk/:index/tts", async (req, res) => {
  const bookId = req.params.id;
  const chunkIndex = Number.parseInt(req.params.index, 10);
  const langParam = (req.query.lang as string | undefined)?.toLowerCase();
  const lang: TtsLang = langParam === "zh" ? "zh" : "en";
  const voiceParam = req.query.voice as string | undefined;
  const voice = resolveVoice(lang, voiceParam);

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    res.status(400).json({ error: "Invalid chunk index" });
    return;
  }

  const book = getBookById(bookId);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  if (chunkIndex >= book.total_chunks) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }

  const chunk = getChunk(bookId, chunkIndex);
  if (!chunk) {
    res.status(404).json({ error: "Chunk not found" });
    return;
  }

  if (!chunk.sentences.length) {
    res.status(422).json({ error: "Chunk has no sentences to synthesize" });
    return;
  }

  try {
    const payload = await synthesizeChunkTts(
      bookId,
      chunkIndex,
      chunk.sentences,
      lang,
      voice
    );
    res.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "TTS synthesis failed";
    if (!message.includes("No speakable OCR text")) {
      console.error("TTS error:", err);
    }
    res.status(422).json({ error: message });
  }
});
