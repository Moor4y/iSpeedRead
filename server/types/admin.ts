export type AdminLang = "en" | "zh";

export type WorkbenchStatus = "uploaded" | "converted" | "promoted" | "error";

export interface WorkbenchItemRecord {
  id: string;
  original_filename: string;
  lang: AdminLang;
  status: WorkbenchStatus;
  title: string | null;
  author: string | null;
  markdown_path: string | null;
  chunks_path: string | null;
  book_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkbenchItemDto {
  id: string;
  originalFilename: string;
  lang: AdminLang;
  status: WorkbenchStatus;
  title: string | null;
  author: string | null;
  markdownPath: string | null;
  chunksPath: string | null;
  bookId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookVersionRecord {
  id: string;
  book_id: string;
  label: string;
  source_md_path: string;
  chunks_path: string;
  lang: AdminLang | null;
  created_at: string;
}

export interface BookVersionDto {
  id: string;
  bookId: string;
  label: string;
  sourceMdPath: string;
  chunksPath: string;
  lang: AdminLang | null;
  createdAt: string;
}
