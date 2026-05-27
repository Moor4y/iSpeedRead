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
