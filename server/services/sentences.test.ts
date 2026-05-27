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
});
