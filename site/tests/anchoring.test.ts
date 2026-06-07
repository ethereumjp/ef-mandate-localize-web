import { describe, it, expect } from "vitest";
import { findOccurrences, codePoints } from "../src/lib/anchoring";

describe("codePoints", () => {
  it("splits by Unicode code point (astral-safe)", () => {
    expect(codePoints("a\u{1F600}b")).toEqual(["a", "\u{1F600}", "b"]);
  });
});

describe("findOccurrences", () => {
  it("finds all start indices of a subsequence", () => {
    expect(findOccurrences(codePoints("abcabc"), codePoints("bc"))).toEqual([1, 4]);
  });
  it("returns [] when the needle is absent", () => {
    expect(findOccurrences(codePoints("abc"), codePoints("z"))).toEqual([]);
  });
  it("returns [] for an empty needle", () => {
    expect(findOccurrences(codePoints("abc"), codePoints(""))).toEqual([]);
  });
  it("works on code points, not UTF-16 units", () => {
    expect(findOccurrences(codePoints("a\u{1F600}b"), codePoints("b"))).toEqual([2]);
  });
});
