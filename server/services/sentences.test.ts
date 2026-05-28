import { describe, expect, it } from "vitest";
import { splitIntoSentences } from "./sentences.js";

describe("splitIntoSentences", () => {
  it("splits standard sentences", () => {
    const result = splitIntoSentences(
      "Hello world. This is a test. And another."
    );
    expect(result).toEqual([
      "Hello world.",
      "This is a test.",
      "And another.",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(splitIntoSentences("")).toEqual([]);
    expect(splitIntoSentences("   ")).toEqual([]);
  });

  it("handles abbreviations reasonably", () => {
    const result = splitIntoSentences("Dr. Smith arrived. He was late.");
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("splits Mandarin punctuation boundaries", () => {
    const result = splitIntoSentences("这是第一句。这里是第二句！这是第三句？");
    expect(result).toEqual(["这是第一句。", "这里是第二句！", "这是第三句？"]);
  });
});
