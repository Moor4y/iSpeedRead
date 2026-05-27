import { describe, expect, it } from "vitest";
import { chunkText } from "./chunker.js";

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

  it("assigns sequential chunk indices", () => {
    const paragraph = "alpha ".repeat(500).trim();
    const fullText = Array(4).fill(paragraph).join("\n\n");
    const chunks = chunkText(fullText, 600);
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });
});
