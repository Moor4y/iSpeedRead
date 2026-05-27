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
}

export interface ReaderCache {
  activeBookId: string;
  checkpointIndex: number;
  cachedChunks: Record<string, Chunk>;
}

export type AppView = "catalog" | "reading";
