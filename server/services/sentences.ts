import sbd from "sbd";

/**
 * Split text into sentences using sentence boundary detection.
 */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const raw = sbd.sentences(trimmed, {
    newline_boundaries: true,
    html_boundaries: false,
    sanitize: false,
  });

  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
