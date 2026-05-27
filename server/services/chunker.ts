import { config } from "../config.js";
import type { ParsedChunk } from "../types/book.js";
import { splitIntoSentences } from "./sentences.js";

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

const CHAPTER_LINE_PATTERN =
  /^(?:(?:chapter|part|section|lecture)\s+)?(\d+|[ivxlcdm]+)\s*[:.)-]?\s*\S+/i;

export function isHeadingLike(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;
  if (CHAPTER_LINE_PATTERN.test(trimmed)) return true;
  if (/[.!?]["']?\s*$/.test(trimmed)) return false;
  if (countWords(trimmed) > 14) return false;
  // Short title-case lines common in technical books (e.g. "The Nature of Complexity")
  if (
    countWords(trimmed) <= 10 &&
    /^[A-Z]/.test(trimmed) &&
    !/^\d+$/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function splitPdfLinesIntoBlocks(text: string): string[] {
  const lines = text
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const blocks: string[] = [];
  let bodyLines: string[] = [];

  const flushBody = () => {
    if (bodyLines.length > 0) {
      blocks.push(bodyLines.join(" "));
      bodyLines = [];
    }
  };

  for (const line of lines) {
    if (isHeadingLike(line)) {
      flushBody();
      const prev = blocks[blocks.length - 1];
      if (
        prev &&
        CHAPTER_LINE_PATTERN.test(prev) &&
        !CHAPTER_LINE_PATTERN.test(line) &&
        countWords(line) <= 10
      ) {
        blocks[blocks.length - 1] = `${prev}: ${line}`;
      } else {
        blocks.push(line);
      }
    } else {
      bodyLines.push(line);
    }
  }
  flushBody();

  return blocks;
}

/** PDF extractors often emit single newlines; rebuild paragraph-like blocks. */
export function splitTextIntoParagraphs(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const rough = splitParagraphs(normalized);
  const expanded: string[] = [];

  for (const block of rough) {
    if (block.includes("\n")) {
      expanded.push(...splitPdfLinesIntoBlocks(block));
    } else {
      expanded.push(block);
    }
  }

  if (expanded.length > 0) {
    return expanded;
  }

  return splitPdfLinesIntoBlocks(normalized);
}

export function extractHeadingCandidate(text: string): string | null {
  const firstParagraph = splitTextIntoParagraphs(text)[0];
  if (!firstParagraph) return null;
  return isHeadingLike(firstParagraph) ? firstParagraph : null;
}

function reindexChunks(chunks: ParsedChunk[]): ParsedChunk[] {
  return chunks.map((chunk, index) => ({ ...chunk, index }));
}

interface ChunkBuildState {
  chunks: ParsedChunk[];
  buffer: string;
  bufferWords: number;
  chunkIndex: number;
  chapterTitle: string | null;
}

function createState(chapterTitle: string | null): ChunkBuildState {
  return {
    chunks: [],
    buffer: "",
    bufferWords: 0,
    chunkIndex: 0,
    chapterTitle,
  };
}

function flush(state: ChunkBuildState, wordTarget: number): void {
  const text = state.buffer.trim();
  if (!text && state.chunks.length === 0) return;
  if (!text) {
    state.buffer = "";
    state.bufferWords = 0;
    return;
  }
  state.chunks.push({
    index: state.chunkIndex++,
    text,
    sentences: splitIntoSentences(text),
    chapterTitle: state.chapterTitle,
  });
  state.buffer = "";
  state.bufferWords = 0;
}

function buildChunksFromParagraphs(
  paragraphs: string[],
  wordTarget: number,
  initialChapterTitle: string | null,
  allowHeadingTitleUpdates: boolean
): ParsedChunk[] {
  const state = createState(initialChapterTitle);

  for (const paragraph of paragraphs) {
    if (allowHeadingTitleUpdates && isHeadingLike(paragraph)) {
      if (state.bufferWords > 0) {
        flush(state, wordTarget);
      }
      state.chapterTitle = paragraph;
      continue;
    }

    const paraWords = countWords(paragraph);

    if (paraWords > wordTarget && state.bufferWords === 0) {
      const sentences = splitIntoSentences(paragraph);
      let sentenceBuffer = "";
      let sentenceWords = 0;

      for (const sentence of sentences) {
        const sw = countWords(sentence);
        if (sentenceWords + sw > wordTarget && sentenceBuffer) {
          state.buffer = sentenceBuffer.trim();
          state.bufferWords = countWords(state.buffer);
          flush(state, wordTarget);
          sentenceBuffer = sentence;
          sentenceWords = sw;
        } else {
          sentenceBuffer = sentenceBuffer
            ? `${sentenceBuffer} ${sentence}`
            : sentence;
          sentenceWords += sw;
        }
      }
      if (sentenceBuffer) {
        state.buffer = sentenceBuffer.trim();
        state.bufferWords = countWords(state.buffer);
        flush(state, wordTarget);
      }
      continue;
    }

    if (state.bufferWords + paraWords > wordTarget && state.bufferWords > 0) {
      flush(state, wordTarget);
    }

    state.buffer = state.buffer ? `${state.buffer}\n\n${paragraph}` : paragraph;
    state.bufferWords = countWords(state.buffer);

    if (state.bufferWords >= wordTarget) {
      flush(state, wordTarget);
    }
  }

  if (state.buffer.trim()) {
    flush(state, wordTarget);
  }

  return state.chunks;
}

/**
 * Assemble full book text into ~600-word chunks, preferring paragraph boundaries.
 */
export function chunkText(
  fullText: string,
  wordTarget: number = config.chunkWordTarget,
  chapterTitle: string | null = null,
  allowHeadingTitleUpdates: boolean = chapterTitle == null
): ParsedChunk[] {
  const normalized = fullText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [
      {
        index: 0,
        text: "",
        sentences: [],
        chapterTitle,
      },
    ];
  }

  const paragraphs = splitTextIntoParagraphs(normalized);
  const chunks = buildChunksFromParagraphs(
    paragraphs,
    wordTarget,
    chapterTitle,
    allowHeadingTitleUpdates
  );

  if (chunks.length === 0) {
    const text = normalized.replace(/\s+/g, " ");
    return [
      {
        index: 0,
        text,
        sentences: splitIntoSentences(text),
        chapterTitle,
      },
    ];
  }

  return chunks;
}

/**
 * Chunk PDF-style text while updating chapter titles at heading-like paragraphs.
 */
export function chunkTextWithChapterBoundaries(
  fullText: string,
  defaultChapterTitle: string = "Document",
  wordTarget: number = config.chunkWordTarget
): ParsedChunk[] {
  const normalized = fullText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return chunkText("", wordTarget, defaultChapterTitle);
  }

  const paragraphs = splitTextIntoParagraphs(normalized);
  const firstHeading =
    paragraphs.find((paragraph) => isHeadingLike(paragraph)) ?? null;
  const initialTitle = firstHeading ?? defaultChapterTitle ?? "Start";

  return buildChunksFromParagraphs(paragraphs, wordTarget, initialTitle, true);
}

export function mergeAndReindexChunkSections(
  sections: ParsedChunk[][]
): ParsedChunk[] {
  return reindexChunks(sections.flat());
}
