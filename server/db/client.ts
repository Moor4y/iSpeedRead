import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config.js";
import type {
  BookMetadataDto,
  BookRecord,
  ChunkDto,
  ParsedChunk,
  SourceType,
} from "../types/book.js";
import type {
  AdminLang,
  BookVersionDto,
  BookVersionRecord,
  WorkbenchItemDto,
  WorkbenchItemRecord,
  WorkbenchStatus,
} from "../types/admin.js";

let db: Database.Database | null = null;

// Inlined so the compiled dist/ bundle has no runtime dependency on schema.sql
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('epub', 'pdf')),
  total_chunks INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
  book_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  sentences_json TEXT NOT NULL,
  chapter_title TEXT,
  PRIMARY KEY (book_id, chunk_index),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_book_index ON chunks (book_id, chunk_index);

CREATE TABLE IF NOT EXISTS workbench_items (
  id TEXT PRIMARY KEY,
  original_filename TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('en', 'zh')),
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'converted', 'promoted', 'error')),
  title TEXT,
  author TEXT,
  markdown_path TEXT,
  chunks_path TEXT,
  book_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workbench_items_created
  ON workbench_items (created_at DESC);

CREATE TABLE IF NOT EXISTS book_versions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  label TEXT NOT NULL,
  source_md_path TEXT NOT NULL,
  chunks_path TEXT NOT NULL,
  lang TEXT CHECK (lang IN ('en', 'zh')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_book_versions_book_created
  ON book_versions (book_id, created_at DESC);
`;

function runMigrations(database: Database.Database): void {
  const columns = database
    .prepare("PRAGMA table_info(chunks)")
    .all() as { name: string }[];

  if (!columns.some((col) => col.name === "chapter_title")) {
    database.exec("ALTER TABLE chunks ADD COLUMN chapter_title TEXT");
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS workbench_items (
      id TEXT PRIMARY KEY,
      original_filename TEXT NOT NULL,
      lang TEXT NOT NULL CHECK (lang IN ('en', 'zh')),
      status TEXT NOT NULL CHECK (status IN ('uploaded', 'converted', 'promoted', 'error')),
      title TEXT,
      author TEXT,
      markdown_path TEXT,
      chunks_path TEXT,
      book_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS book_versions (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      label TEXT NOT NULL,
      source_md_path TEXT NOT NULL,
      chunks_path TEXT NOT NULL,
      lang TEXT CHECK (lang IN ('en', 'zh')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
  `);
}

function mapWorkbenchItem(row: WorkbenchItemRecord): WorkbenchItemDto {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    lang: row.lang,
    status: row.status,
    title: row.title,
    author: row.author,
    markdownPath: row.markdown_path,
    chunksPath: row.chunks_path,
    bookId: row.book_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBookVersion(row: BookVersionRecord): BookVersionDto {
  return {
    id: row.id,
    bookId: row.book_id,
    label: row.label,
    sourceMdPath: row.source_md_path,
    chunksPath: row.chunks_path,
    lang: row.lang,
    createdAt: row.created_at,
  };
}

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  runMigrations(db);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function insertBookWithChunks(
  book: {
    id: string;
    title: string;
    author: string;
    sourceFilename: string;
    sourceType: SourceType;
    chunks: ParsedChunk[];
  }
): void {
  const database = getDb();
  const insertBook = database.prepare(`
    INSERT INTO books (id, title, author, source_filename, source_type, total_chunks)
    VALUES (@id, @title, @author, @sourceFilename, @sourceType, @totalChunks)
  `);
  const insertChunk = database.prepare(`
    INSERT INTO chunks (book_id, chunk_index, text, sentences_json, chapter_title)
    VALUES (@bookId, @chunkIndex, @text, @sentencesJson, @chapterTitle)
  `);

  const transaction = database.transaction(() => {
    insertBook.run({
      id: book.id,
      title: book.title,
      author: book.author,
      sourceFilename: book.sourceFilename,
      sourceType: book.sourceType,
      totalChunks: book.chunks.length,
    });

    for (const chunk of book.chunks) {
      insertChunk.run({
        bookId: book.id,
        chunkIndex: chunk.index,
        text: chunk.text,
        sentencesJson: JSON.stringify(chunk.sentences),
        chapterTitle: chunk.chapterTitle ?? null,
      });
    }
  });

  transaction();
}

export function listBooks(): BookMetadataDto[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT id, title, author, total_chunks FROM books ORDER BY created_at DESC`
    )
    .all() as Pick<BookRecord, "id" | "title" | "author" | "total_chunks">[];

  return rows.map((row) => ({
    bookId: row.id,
    title: row.title,
    author: row.author,
    totalChunks: row.total_chunks,
  }));
}

export function getBookById(id: string): BookRecord | undefined {
  const database = getDb();
  return database
    .prepare(`SELECT * FROM books WHERE id = ?`)
    .get(id) as BookRecord | undefined;
}

export function deleteBook(id: string): boolean {
  const database = getDb();
  const result = database.prepare(`DELETE FROM books WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function getChunk(
  bookId: string,
  chunkIndex: number
): ChunkDto | undefined {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT chunk_index, text, sentences_json, chapter_title FROM chunks
       WHERE book_id = ? AND chunk_index = ?`
    )
    .get(bookId, chunkIndex) as
    | {
        chunk_index: number;
        text: string;
        sentences_json: string;
        chapter_title: string | null;
      }
    | undefined;

  if (!row) return undefined;

  return {
    index: row.chunk_index,
    text: row.text,
    sentences: JSON.parse(row.sentences_json) as string[],
    chapterTitle: row.chapter_title,
  };
}

export function createWorkbenchItem(input: {
  id: string;
  originalFilename: string;
  lang: AdminLang;
}): WorkbenchItemDto {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO workbench_items (
        id, original_filename, lang, status, title, author, markdown_path, chunks_path, book_id, error_message
      ) VALUES (
        @id, @originalFilename, @lang, 'uploaded', NULL, NULL, NULL, NULL, NULL, NULL
      )`
    )
    .run(input);

  const row = database
    .prepare(`SELECT * FROM workbench_items WHERE id = ?`)
    .get(input.id) as WorkbenchItemRecord;
  return mapWorkbenchItem(row);
}

export function listWorkbenchItems(): WorkbenchItemDto[] {
  const database = getDb();
  const rows = database
    .prepare(`SELECT * FROM workbench_items ORDER BY created_at DESC`)
    .all() as WorkbenchItemRecord[];
  return rows.map(mapWorkbenchItem);
}

export function getWorkbenchItem(id: string): WorkbenchItemDto | undefined {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM workbench_items WHERE id = ?`)
    .get(id) as WorkbenchItemRecord | undefined;
  return row ? mapWorkbenchItem(row) : undefined;
}

export function updateWorkbenchAfterConvert(input: {
  id: string;
  lang: AdminLang;
  title: string;
  author: string;
  markdownPath: string;
  chunksPath: string;
  status?: Extract<WorkbenchStatus, "converted" | "error">;
  errorMessage?: string | null;
}): boolean {
  const database = getDb();
  const result = database
    .prepare(
      `UPDATE workbench_items
       SET lang = @lang,
           status = @status,
           title = @title,
           author = @author,
           markdown_path = @markdownPath,
           chunks_path = @chunksPath,
           error_message = @errorMessage,
           updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({
      ...input,
      status: input.status ?? "converted",
      errorMessage: input.errorMessage ?? null,
    });
  return result.changes > 0;
}

export function markWorkbenchError(id: string, message: string): boolean {
  const database = getDb();
  const result = database
    .prepare(
      `UPDATE workbench_items
       SET status = 'error',
           error_message = @message,
           updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({ id, message });
  return result.changes > 0;
}

export function markWorkbenchPromoted(input: {
  id: string;
  bookId: string;
}): boolean {
  const database = getDb();
  const result = database
    .prepare(
      `UPDATE workbench_items
       SET status = 'promoted',
           book_id = @bookId,
           markdown_path = NULL,
           chunks_path = NULL,
           error_message = NULL,
           updated_at = datetime('now')
       WHERE id = @id`
    )
    .run(input);
  return result.changes > 0;
}

export function deleteWorkbenchItem(id: string): boolean {
  const database = getDb();
  const result = database
    .prepare(`DELETE FROM workbench_items WHERE id = ?`)
    .run(id);
  return result.changes > 0;
}

export function createBookVersion(input: {
  id: string;
  bookId: string;
  label: string;
  sourceMdPath: string;
  chunksPath: string;
  lang: AdminLang | null;
}): BookVersionDto {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO book_versions (id, book_id, label, source_md_path, chunks_path, lang)
       VALUES (@id, @bookId, @label, @sourceMdPath, @chunksPath, @lang)`
    )
    .run(input);

  const row = database
    .prepare(`SELECT * FROM book_versions WHERE id = ?`)
    .get(input.id) as BookVersionRecord;
  return mapBookVersion(row);
}

export function listBookVersions(bookId: string): BookVersionDto[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT * FROM book_versions
       WHERE book_id = ?
       ORDER BY created_at DESC`
    )
    .all(bookId) as BookVersionRecord[];
  return rows.map(mapBookVersion);
}
