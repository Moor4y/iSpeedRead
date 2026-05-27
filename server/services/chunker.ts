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

/**
 * Assemble full book text into ~600-word chunks, preferring paragraph boundaries.
 */
export function chunkText(
  fullText: string,
  wordTarget: number = config.chunkWordTarget
): ParsedChunk[] {
  const normalized = fullText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [
      {
        index: 0,
        text: "",
        sentences: [],
      },
    ];
  }

  const paragraphs = splitParagraphs(normalized);
  const chunks: ParsedChunk[] = [];
  let buffer = "";
  let bufferWords = 0;
  let chunkIndex = 0;

  const flush = () => {
    const text = buffer.trim();
    if (!text && chunks.length === 0) return;
    if (!text) {
      buffer = "";
      bufferWords = 0;
      return;
    }
    chunks.push({
      index: chunkIndex++,
      text,
      sentences: splitIntoSentences(text),
    });
    buffer = "";
    bufferWords = 0;
  };

  for (const paragraph of paragraphs) {
    const paraWords = countWords(paragraph);

    if (paraWords > wordTarget && bufferWords === 0) {
      // Oversized paragraph: split on sentence boundaries
      const sentences = splitIntoSentences(paragraph);
      let sentenceBuffer = "";
      let sentenceWords = 0;

      for (const sentence of sentences) {
        const sw = countWords(sentence);
        if (sentenceWords + sw > wordTarget && sentenceBuffer) {
          buffer = sentenceBuffer.trim();
          bufferWords = countWords(buffer);
          flush();
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
        buffer = sentenceBuffer.trim();
        bufferWords = countWords(buffer);
        flush();
      }
      continue;
    }

    if (bufferWords + paraWords > wordTarget && bufferWords > 0) {
      flush();
    }

    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    bufferWords = countWords(buffer);

    if (bufferWords >= wordTarget) {
      flush();
    }
  }

  if (buffer.trim()) {
    flush();
  }

  if (chunks.length === 0) {
    const text = normalized.replace(/\s+/g, " ");
    chunks.push({
      index: 0,
      text,
      sentences: splitIntoSentences(text),
    });
  }

  return chunks;
}
