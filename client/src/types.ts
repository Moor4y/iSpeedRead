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

export const READER_CACHE_VERSION = 3;

export interface ReaderCache {
  version?: number;
  activeBookId: string;
  checkpointIndex: number;
  cachedChunks: Record<string, Chunk>;
}

export type AppView = "catalog" | "reading";

export type TtsLang = "en" | "zh";

export type TtsVoice =
  | "en-US-AndrewNeural"
  | "en-US-AvaNeural"
  | "zh-CN-YunxiNeural"
  | "zh-CN-XiaoxiaoNeural";

export interface TtsVoiceOption {
  voice: TtsVoice;
  label: string;
  lang: TtsLang;
}

export const TTS_VOICE_OPTIONS: TtsVoiceOption[] = [
  { voice: "en-US-AndrewNeural",   label: "Andrew", lang: "en" },
  { voice: "en-US-AvaNeural",      label: "Ava",    lang: "en" },
  { voice: "zh-CN-YunxiNeural",    label: "云希",    lang: "zh" },
  { voice: "zh-CN-XiaoxiaoNeural", label: "晓晓",    lang: "zh" },
];

export const TTS_DEFAULT_VOICE: Record<TtsLang, TtsVoice> = {
  en: "en-US-AndrewNeural",
  zh: "zh-CN-XiaoxiaoNeural",
};

/**
 * Speed steps shown in the UI.
 * The server bakes in 2× ("+100%" prosody rate), so the client multiplier
 * shown here is applied on top. 2.0 client × 2.0 server = 4.0× effective.
 */
export const TTS_SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Effective speed label = client rate × 2 (server bakes 2×) */
export function effectiveSpeed(clientRate: number): string {
  return `${(clientRate * 2).toFixed(2)}×`;
}

export interface TtsPrefs {
  lang: TtsLang;
  voiceByLang: Record<TtsLang, TtsVoice>;
  clientRate: number;
}

export interface SentenceMarker {
  sentenceIndex: number;
  startMs: number;
  endMs: number;
}

export interface TtsPayload {
  bookId: string;
  chunkIndex: number;
  voice: TtsVoice;
  lang: TtsLang;
  audioBase64: string;
  mimeType: string;
  timeline: SentenceMarker[];
  durationMs: number;
}
