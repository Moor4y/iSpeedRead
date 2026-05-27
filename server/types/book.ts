export type SourceType = "epub" | "pdf";

export interface ParsedChunk {
  index: number;
  text: string;
  sentences: string[];
}

export interface ParseResult {
  title: string;
  author: string;
  chunks: ParsedChunk[];
}

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  source_filename: string;
  source_type: SourceType;
  total_chunks: number;
  created_at: string;
}

export interface ChunkRecord {
  book_id: string;
  chunk_index: number;
  text: string;
  sentences_json: string;
}

export interface BookMetadataDto {
  bookId: string;
  title: string;
  author: string;
  totalChunks: number;
}

export interface ChunkDto {
  index: number;
  text: string;
  sentences: string[];
}

export interface UploadResponseDto {
  bookId: string;
  title: string;
  author: string;
  totalChunks: number;
}
