import { describe, it, expect } from "vitest";
import { chapterTitle, mergeChapter } from "../src/lib/content";
import { parseChapter } from "../src/lib/blocks";

describe("chapterTitle", () => {
  it("strips the leading heading marks", () => {
    expect(chapterTitle("# II. Our Role")).toBe("II. Our Role");
  });
});

describe("mergeChapter", () => {
  it("merges aligned EN/JA by blockId", () => {
    const en = parseChapter("<!-- block: 02-p1 -->\n# Title\n\n<!-- block: 02-p2 -->\nBody");
    const ja = parseChapter("<!-- block: 02-p1 -->\n# 題\n\n<!-- block: 02-p2 -->\n本文");
    const ch = mergeChapter("02", en, ja);
    expect(ch.jaPending).toBe(false);
    expect(ch.title).toBe("Title");
    expect(ch.jaTitle).toBe("題");
    expect(ch.blocks).toHaveLength(2);
    expect(ch.blocks[0].blockId).toBe("02-p1");
    expect(ch.blocks[0].enHtml).toContain("Title");
    expect(ch.blocks[0].jaHtml).toContain("題");
  });
  it("marks the chapter pending when JA block count differs (stub)", () => {
    const en = parseChapter("<!-- block: 04-p1 -->\n# Title\n\n<!-- block: 04-p2 -->\nBody");
    const ja = parseChapter("# 題"); // stub: 1 unmarked block
    const ch = mergeChapter("04", en, ja);
    expect(ch.jaPending).toBe(true);
    expect(ch.jaTitle).toBeNull();
    expect(ch.blocks[0].jaHtml).toBeNull();
  });
  it("treats a null JA chapter as pending", () => {
    const en = parseChapter("<!-- block: 07-p1 -->\n# Title");
    const ch = mergeChapter("07", en, null);
    expect(ch.jaPending).toBe(true);
    expect(ch.blocks[0].jaHtml).toBeNull();
  });
  it("throws if an EN block is unmarked", () => {
    const en = parseChapter("# Title"); // no marker
    expect(() => mergeChapter("02", en, null)).toThrow(/unmarked/);
  });
});
