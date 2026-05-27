import localforage from "localforage";
import { fetchChunk } from "./api";
import type { Chunk, ReaderCache } from "./types";

const CACHE_KEY = "ispeedread-reader-cache";
const LOOKAHEAD_CHUNKS = 5;

const store = localforage.createInstance({
  name: "ispeedread",
  storeName: "reader",
});

export async function loadReaderCache(): Promise<ReaderCache | null> {
  return store.getItem<ReaderCache>(CACHE_KEY);
}

export async function saveReaderCache(cache: ReaderCache): Promise<void> {
  await store.setItem(CACHE_KEY, cache);
}

export async function getCachedChunk(
  bookId: string,
  index: number
): Promise<Chunk | null> {
  const cache = await loadReaderCache();
  if (!cache || cache.activeBookId !== bookId) return null;
  return cache.cachedChunks[String(index)] ?? null;
}

export async function ensureChunk(
  bookId: string,
  index: number,
  totalChunks: number
): Promise<Chunk | null> {
  if (index < 0 || index >= totalChunks) return null;

  const cached = await getCachedChunk(bookId, index);
  if (cached) return cached;

  try {
    const chunk = await fetchChunk(bookId, index);
    await mergeChunkIntoCache(bookId, chunk);
    return chunk;
  } catch {
    const stale = await getCachedChunk(bookId, index);
    return stale;
  }
}

export async function mergeChunkIntoCache(
  bookId: string,
  chunk: Chunk
): Promise<void> {
  const existing = (await loadReaderCache()) ?? {
    activeBookId: bookId,
    checkpointIndex: chunk.index,
    cachedChunks: {},
  };

  if (existing.activeBookId !== bookId) {
    existing.activeBookId = bookId;
    existing.cachedChunks = {};
  }

  existing.cachedChunks[String(chunk.index)] = chunk;
  await saveReaderCache(existing);
}

export async function setCheckpoint(
  bookId: string,
  checkpointIndex: number
): Promise<void> {
  const existing = (await loadReaderCache()) ?? {
    activeBookId: bookId,
    checkpointIndex,
    cachedChunks: {},
  };

  existing.activeBookId = bookId;
  existing.checkpointIndex = checkpointIndex;
  await saveReaderCache(existing);
}

/** Prefetch checkpoint window and up to LOOKAHEAD_CHUNKS ahead for offline resilience. */
export async function prefetchWindow(
  bookId: string,
  checkpointIndex: number,
  totalChunks: number
): Promise<void> {
  const indices = new Set<number>();

  for (let i = checkpointIndex - 1; i <= checkpointIndex + 1; i++) {
    if (i >= 0 && i < totalChunks) indices.add(i);
  }

  for (let i = 1; i <= LOOKAHEAD_CHUNKS; i++) {
    const ahead = checkpointIndex + i;
    if (ahead < totalChunks) indices.add(ahead);
  }

  await Promise.all(
    [...indices].map((index) => ensureChunk(bookId, index, totalChunks))
  );
}

export async function initBookCache(
  bookId: string,
  startIndex: number
): Promise<void> {
  await saveReaderCache({
    activeBookId: bookId,
    checkpointIndex: startIndex,
    cachedChunks: {},
  });
}
