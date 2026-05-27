import localforage from "localforage";
import type { TtsLang, TtsPrefs, TtsVoice } from "../types";
import { TTS_DEFAULT_VOICE } from "../types";

const PREFS_KEY = "tts-prefs";

const prefsStore = localforage.createInstance({
  name: "ispeedread",
  storeName: "tts-prefs",
});

export async function loadTtsPrefs(): Promise<TtsPrefs> {
  const stored = await prefsStore.getItem<TtsPrefs>(PREFS_KEY);
  if (stored) return stored;
  return {
    lang: "en",
    voiceByLang: { ...TTS_DEFAULT_VOICE },
    clientRate: 1,
  };
}

export async function saveTtsPrefs(prefs: TtsPrefs): Promise<void> {
  await prefsStore.setItem(PREFS_KEY, prefs);
}

export async function updateTtsPrefs(
  patch: Partial<TtsPrefs>
): Promise<TtsPrefs> {
  const current = await loadTtsPrefs();
  const next: TtsPrefs = { ...current, ...patch };
  await saveTtsPrefs(next);
  return next;
}

export async function setVoiceForLang(
  lang: TtsLang,
  voice: TtsVoice
): Promise<TtsPrefs> {
  const current = await loadTtsPrefs();
  const next: TtsPrefs = {
    ...current,
    voiceByLang: { ...current.voiceByLang, [lang]: voice },
  };
  await saveTtsPrefs(next);
  return next;
}
