import sbd from "sbd";

const CJK_CHAR_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

function splitLongCjkClause(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= 80) return [trimmed];

  const byComma = trimmed
    .split(/(?<=[，、；;])/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (byComma.length > 1) {
    return byComma.flatMap((part) =>
      part.length > 80 ? splitLongCjkClause(part) : [part]
    );
  }

  // Last fallback for punctuation-poor OCR text.
  const slices: string[] = [];
  for (let i = 0; i < trimmed.length; i += 48) {
    slices.push(trimmed.slice(i, i + 48));
  }
  return slices;
}

function splitCjkSentences(text: string): string[] {
  // Keep sentence-ending punctuation attached to each segment.
  const parts = text.match(/[^。！？!?；;]+[。！？!?；;]?/gu) ?? [];
  return parts.flatMap((part) =>
    splitLongCjkClause(part)
  )
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function splitLatinSentences(text: string): string[] {
  const raw = sbd.sentences(text, {
    newline_boundaries: true,
    html_boundaries: false,
    sanitize: false,
  });
  return raw
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Split text into sentences using sentence boundary detection.
 */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (CJK_CHAR_PATTERN.test(trimmed)) {
    const cjk = splitCjkSentences(trimmed);
    if (cjk.length > 0) return cjk;
  }

  return splitLatinSentences(trimmed);
}
