import type { Chunk } from "../types";

function isHeadingLikeSentence(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 120) return false;
  if (
    /^(?:(?:chapter|part|section)\s+)?(\d+|[ivxlcdm]+)\s*[:.)-]?\s*\S+/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (/[.!?]["']?\s*$/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  return words.length <= 12 && /^[A-Z]/.test(trimmed);
}

export function getDisplayChapterTitle(chunk: Chunk | null): string {
  if (!chunk) return "";

  if (chunk.chapterTitle?.trim()) {
    const title = chunk.chapterTitle.trim();
    // Don't repeat the book title as the chapter line
    if (title.length > 0) return title;
  }

  const firstSentence = chunk.sentences[0]?.trim();
  if (firstSentence && isHeadingLikeSentence(firstSentence)) {
    return firstSentence;
  }

  return `Page ${chunk.index + 1}`;
}
