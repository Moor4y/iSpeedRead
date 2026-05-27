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
  { voice: "en-US-AndrewNeural",    label: "Andrew",   lang: "en" },
  { voice: "en-US-AvaNeural",       label: "Ava",      lang: "en" },
  { voice: "zh-CN-YunxiNeural",     label: "云希",      lang: "zh" },
  { voice: "zh-CN-XiaoxiaoNeural",  label: "晓晓",      lang: "zh" },
];

/** Default voice per language */
export const TTS_DEFAULT_VOICE: Record<TtsLang, TtsVoice> = {
  en: "en-US-AndrewNeural",
  zh: "zh-CN-XiaoxiaoNeural",
};

/**
 * Rate baked into the server-side synthesis request.
 * Edge TTS accepts SSML prosody rate as a percentage string.
 * "+100%" = 2× speed. Combined with client playbackRate this reaches 4×.
 */
export const TTS_SERVER_RATE = "+100%";

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
