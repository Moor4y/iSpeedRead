import localforage from "localforage";
import { fetchChunkTts } from "../api";
import type { TtsLang, TtsPayload, TtsVoice } from "../types";

const ttsStore = localforage.createInstance({
  name: "ispeedread",
  storeName: "tts",
});

/** Cache key includes voice so different voices are stored independently. */
function cacheKey(bookId: string, chunkIndex: number, voice: TtsVoice): string {
  return `${bookId}:${chunkIndex}:${voice}`;
}

/** In-memory double buffer: current + prefetched next */
const memoryBuffer = new Map<string, TtsPayload>();

export async function loadTtsPayload(
  bookId: string,
  chunkIndex: number,
  lang: TtsLang,
  voice: TtsVoice
): Promise<TtsPayload> {
  const key = cacheKey(bookId, chunkIndex, voice);

  const inMemory = memoryBuffer.get(key);
  if (inMemory) return inMemory;

  const stored = await ttsStore.getItem<TtsPayload>(key);
  if (stored) {
    memoryBuffer.set(key, stored);
    return stored;
  }

  const payload = await fetchChunkTts(bookId, chunkIndex, lang, voice);
  memoryBuffer.set(key, payload);
  await ttsStore.setItem(key, payload);
  return payload;
}

/** Prefetch next chunk audio while current plays (double-buffer lookahead). */
export function prefetchTts(
  bookId: string,
  chunkIndex: number,
  lang: TtsLang,
  voice: TtsVoice
): void {
  if (chunkIndex < 0) return;
  const key = cacheKey(bookId, chunkIndex, voice);
  if (memoryBuffer.has(key)) return;

  void loadTtsPayload(bookId, chunkIndex, lang, voice).catch((err) => {
    console.warn(`TTS prefetch failed for chunk ${chunkIndex}:`, err);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export function findActiveSentenceIndex(
  timeline: TtsPayload["timeline"],
  currentTimeSec: number
): number | null {
  const ms = currentTimeSec * 1000;
  const marker = timeline.find((m) => ms >= m.startMs && ms < m.endMs);
  return marker?.sentenceIndex ?? null;
}
