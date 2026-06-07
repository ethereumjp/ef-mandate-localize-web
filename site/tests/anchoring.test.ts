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

import { project } from "../src/lib/anchoring";

describe("project", () => {
  const H1 = "0x01" as `0x${string}`;
  const H2 = "0x02" as `0x${string}`;

  it("orphaned when the block is gone", () => {
    const a = makeAnchor(H1, "the walkaway test is robust", 4, 12); // "walkaway"
    expect(project(a, null)).toEqual({
      status: "orphaned",
      start: null,
      end: null,
      pastVersion: true,
    });
  });

  it("anchored (offsets verbatim) when the block hash is unchanged", () => {
    const text = "the walkaway test is robust";
    const a = makeAnchor(H1, text, 4, 12);
    expect(project(a, { blockHash: H1, text })).toEqual({
      status: "anchored",
      start: 4,
      end: 12,
      pastVersion: false,
    });
  });

  it("re-anchored when the block changed but the quote moved (unique)", () => {
    const original = "the walkaway test is robust";
    const a = makeAnchor(H1, original, 4, 12); // "walkaway"
    const edited = "we think the walkaway test is robust"; // shifted
    const p = project(a, { blockHash: H2, text: edited });
    expect(p.status).toBe("re-anchored");
    expect(p.pastVersion).toBe(true);
    expect(edited.slice(p.start!, p.end!)).toBe("walkaway");
  });

  it("needs-review when the quoted text is gone", () => {
    const original = "the walkaway test is robust";
    const a = makeAnchor(H1, original, 4, 12); // "walkaway"
    const edited = "the leave test is robust"; // "walkaway" removed
    expect(project(a, { blockHash: H2, text: edited })).toEqual({
      status: "needs-review",
      start: null,
      end: null,
      pastVersion: true,
    });
  });
});

describe("project — disambiguation", () => {
  const H1 = "0x01" as `0x${string}`;
  const H2 = "0x02" as `0x${string}`;

  it("re-anchors to the context-matching occurrence when the quote repeats", () => {
    const original = "the walkaway test, not the unit test";
    const a = makeAnchor(H1, original, 13, 17); // first "test"
    expect(a.exact).toBe("test");
    const edited = "note: the walkaway test, not the unit test";
    const p = project(a, { blockHash: H2, text: edited });
    expect(p.status).toBe("re-anchored");
    expect(p.start).toBe(19); // the first "test" in the edited text
    expect(edited.slice(p.start!, p.end!)).toBe("test");
  });

  it("needs-review when repeated quote can't be disambiguated by context", () => {
    const original = "ab xx cd xx ef";
    const a = makeAnchor(H1, original, 3, 5, 0); // "xx", NO context captured
    const edited = "z ab xx cd xx ef";
    expect(project(a, { blockHash: H2, text: edited })).toEqual({
      status: "needs-review",
      start: null,
      end: null,
      pastVersion: true,
    });
  });
});
