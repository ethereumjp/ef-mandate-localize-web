import { describe, it, expect } from "vitest";
import { findOccurrences, codePoints, makeAnchor } from "../src/lib/anchoring";

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

describe("makeAnchor", () => {
  const H = "0x00" as const;

  it("captures exact + prefix/suffix context from a code-point span", () => {
    const a = makeAnchor(H as `0x${string}`, "The quick brown fox", 4, 9, 3); // "quick"
    expect(a.exact).toBe("quick");
    expect(a.prefix).toBe("he "); // last 3 cps before index 4
    expect(a.suffix).toBe(" br"); // first 3 cps after index 9
    expect(a.start).toBe(4);
    expect(a.end).toBe(9);
    expect(a.blockHash).toBe(H);
  });

  it("clamps context at block edges", () => {
    const a = makeAnchor(H as `0x${string}`, "abcdef", 0, 2, 10); // "ab" at the start
    expect(a.exact).toBe("ab");
    expect(a.prefix).toBe(""); // nothing before index 0
    expect(a.suffix).toBe("cdef"); // only 4 cps available after
  });

  it("uses code points for CJK text", () => {
    const a = makeAnchor(H as `0x${string}`, "財団の役割について", 0, 2, 2); // "財団"
    expect(a.exact).toBe("財団");
    expect(a.prefix).toBe("");
    expect(a.suffix).toBe("の役");
  });

  it("throws on an invalid span", () => {
    expect(() => makeAnchor(H as `0x${string}`, "abc", 2, 2)).toThrow(/invalid span/);
    expect(() => makeAnchor(H as `0x${string}`, "abc", 0, 9)).toThrow(/invalid span/);
  });
});
