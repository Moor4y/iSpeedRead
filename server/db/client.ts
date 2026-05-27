import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config } from "../config.js";
import type {
  BookMetadataDto,
  BookRecord,
  ChunkDto,
  ParsedChunk,
  SourceType,
} from "../types/book.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

function readSchema(): string {
  const schemaFile = path.join(__dirname, "schema.sql");
  return fs.readFileSync(schemaFile, "utf-8");
}

function runMigrations(database: Database.Database): void {
  const columns = database
    .prepare("PRAGMA table_info(chunks)")
    .all() as { name: string }[];

  if (!columns.some((col) => col.name === "chapter_title")) {
    database.exec("ALTER TABLE chunks ADD COLUMN chapter_title TEXT");
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(readSchema());
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
