import { describe, it, expect } from "vitest";
import { assignEnIds, alignTranslationIds, renderChapter } from "../src/lib/inject";
import { parseChapter } from "../src/lib/blocks";

describe("assignEnIds", () => {
  it("assigns p1.. in order to unmarked blocks", () => {
    const blocks = assignEnIds(parseChapter("A\n\nB\n\nC"), "02");
    expect(blocks.map((b) => b.id)).toEqual(["02-p1", "02-p2", "02-p3"]);
  });
  it("preserves existing ids and gives new blocks max+1", () => {
    const src = "<!-- block: 02-p1 -->\nA\n\nB\n\n<!-- block: 02-p5 -->\nC";
    const blocks = assignEnIds(parseChapter(src), "02");
    expect(blocks.map((b) => b.id)).toEqual(["02-p1", "02-p6", "02-p5"]);
  });
});

describe("alignTranslationIds", () => {
  it("copies EN ids by position", () => {
    const blocks = alignTranslationIds(parseChapter("X\n\nY"), ["02-p1", "02-p2"], "02");
    expect(blocks.map((b) => b.id)).toEqual(["02-p1", "02-p2"]);
  });
  it("throws when block counts differ", () => {
    expect(() => alignTranslationIds(parseChapter("X"), ["02-p1", "02-p2"], "02")).toThrow(
      /1 blocks but EN has 2/,
    );
  });
});

describe("renderChapter", () => {
  it("writes a marker line above each block, one blank line between", () => {
    const blocks = assignEnIds(parseChapter("A\n\nB"), "02");
    expect(renderChapter(blocks)).toBe("<!-- block: 02-p1 -->\nA\n\n<!-- block: 02-p2 -->\nB\n");
  });
});
