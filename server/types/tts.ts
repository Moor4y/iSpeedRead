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

export const TTS_VOICES: Record<TtsLang, string> = {
  en: "en-US-JennyNeural",
  zh: "zh-CN-XiaoxiaoNeural",
};
