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
