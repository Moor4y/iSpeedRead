import { Router } from "express";
import { getBookById, getChunk, listBooks } from "../db/client.js";
import { synthesizeChunkTts } from "../services/tts.js";
import type { TtsLang } from "../types/tts.js";

export const booksRouter = Router();

booksRouter.get("/", (_req, res) => {
  const books = listBooks();
  res.json(books);
});

booksRouter.get("/:id", (req, res) => {
  const book = getBookById(req.params.id);
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  res.json({
    bookId: book.id,
    title: book.title,
    author: book.author,
    totalChunks: book.total_chunks,
    sourceType: book.source_type,
    createdAt: book.created_at,
  });
});

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

booksRouter.get("/:id/chunk/:index/tts", async (req, res) => {
  const bookId = req.params.id;
  const chunkIndex = Number.parseInt(req.params.index, 10);
  const langParam = (req.query.lang as string | undefined)?.toLowerCase();
  const lang: TtsLang = langParam === "zh" ? "zh" : "en";

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
      lang
    );
    res.json(payload);
  } catch (err) {
    console.error("TTS error:", err);
    const message =
      err instanceof Error ? err.message : "TTS synthesis failed";
    res.status(422).json({ error: message });
  }
});
