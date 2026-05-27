export interface BookMetadata {
  bookId: string;
  title: string;
  author: string;
  totalChunks: number;
}

export interface Chunk {
  index: number;
  text: string;
  sentences: string[];
  chapterTitle?: string | null;
}

export const READER_CACHE_VERSION = 2;

export interface ReaderCache {
  version?: number;
  activeBookId: string;
  checkpointIndex: number;
  cachedChunks: Record<string, Chunk>;
}

export type AppView = "catalog" | "reading";

export type TtsLang = "en" | "zh";

export interface SentenceMarker {
  sentenceIndex: number;
  startMs: number;
  endMs: number;
}

export interface TtsPayload {
  bookId: string;
  chunkIndex: number;
  voice: string;
  lang: TtsLang;
  audioBase64: string;
  mimeType: string;
  timeline: SentenceMarker[];
  durationMs: number;
}
