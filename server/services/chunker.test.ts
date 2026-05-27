import { describe, expect, it } from "vitest";
import {
  chunkText,
  chunkTextWithChapterBoundaries,
  isHeadingLike,
  splitTextIntoParagraphs,
} from "./chunker.js";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const chunks = chunkText("Hello world. This is a test.", 600);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].sentences.length).toBeGreaterThan(0);
  });

  it("splits on paragraph boundaries when exceeding word target", () => {
    const paragraph = "word ".repeat(400).trim();
    const fullText = `${paragraph}\n\n${paragraph}`;
    const chunks = chunkText(fullText, 600);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(0);
      expect(chunk.sentences.length).toBeGreaterThan(0);
    }
  });

  it("detects chapter-style headings", () => {
    expect(isHeadingLike("Chapter 3: The Nature of Complexity")).toBe(true);
    expect(isHeadingLike("This is a normal sentence.")).toBe(false);
  });

  it("splits PDF-style single newlines into blocks", () => {
    const text =
      "Chapter 1\nIntroduction\n\nFirst paragraph of body.\nSecond line.";
    const blocks = splitTextIntoParagraphs(text);
    expect(blocks[0]).toMatch(/Chapter 1/);
    expect(blocks.some((b) => b.includes("First paragraph"))).toBe(true);
  });

  it("assigns chapter titles across PDF chunks", () => {
    const body = "word ".repeat(400).trim();
    const text = `Chapter 1\nIntro\n\n${body}\n\nChapter 2\nNext\n\n${body}`;
    const chunks = chunkTextWithChapterBoundaries(text, "Start");
    expect(chunks.some((c) => c.chapterTitle?.includes("Chapter 1"))).toBe(
      true
    );
    expect(chunks.some((c) => c.chapterTitle?.includes("Chapter 2"))).toBe(
      true
    );
  });

  it("assigns sequential chunk indices", () => {
    const paragraph = "alpha ".repeat(500).trim();
    const fullText = Array(4).fill(paragraph).join("\n\n");
    const chunks = chunkText(fullText, 600);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });
});
