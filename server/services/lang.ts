import type { AdminLang } from "../types/admin.js";

const CJK_CHAR_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;

export function cjkDensity(text: string): number {
  if (!text) return 0;
  const chars = Array.from(text);
  if (chars.length === 0) return 0;
  const cjkCount = text.match(CJK_CHAR_PATTERN)?.length ?? 0;
  return cjkCount / chars.length;
}

export function detectAdminLangFromText(text: string): AdminLang {
  return cjkDensity(text) >= 0.1 ? "zh" : "en";
}
