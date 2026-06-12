import { describe, it, expect } from "vitest";
import { parseChapter, type Block } from "../src/lib/blocks";
import { renderMarkdown } from "../src/lib/render";
import { mergeChapter, blockHtml, titleFor, isPending, isFallback } from "../src/lib/content";
import type { Lang } from "../src/lib/i18n";

const en = parseChapter(
  "<!-- block: 01-h -->\n# Chapter One\n\n<!-- block: 01-p -->\nEnglish body.",
);
const jaAligned = parseChapter(
  "<!-- block: 01-h -->\n# 第一章\n\n<!-- block: 01-p -->\n日本語の本文。",
);
const jaMisaligned = parseChapter("<!-- block: 01-h -->\n# 第一章のみ"); // 1 block ≠ 2

describe("mergeChapter", () => {
  it("stores a translation when aligned", () => {
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>([["ja", jaAligned]]));
    expect(ch.sourceTitle).toBe("Chapter One");
    expect(ch.translations.ja?.title).toBe("第一章");
    expect(isPending(ch, "ja")).toBe(false);
    expect(ch.blocks[1].translations.ja).toBe(renderMarkdown("日本語の本文。"));
    expect(blockHtml(ch.blocks[1], "ja")).toBe(renderMarkdown("日本語の本文。"));
    expect(isFallback(ch.blocks[1], "ja")).toBe(false);
  });

  it("falls back to EN when a translation is misaligned (pending)", () => {
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>([["ja", jaMisaligned]]));
    expect(ch.translations.ja).toBeUndefined();
    expect(isPending(ch, "ja")).toBe(true);
    expect(titleFor(ch, "ja")).toBe("Chapter One");
    expect(blockHtml(ch.blocks[0], "ja")).toBe(renderMarkdown("# Chapter One"));
    expect(isFallback(ch.blocks[0], "ja")).toBe(true);
  });

  it("treats a missing language as pending", () => {
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>());
    expect(isPending(ch, "ja")).toBe(true);
    expect(blockHtml(ch.blocks[1], "ja")).toBe(renderMarkdown("English body."));
  });

  it("never reports pending/fallback for the source language", () => {
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>([["ja", jaAligned]]));
    expect(isPending(ch, "en")).toBe(false);
    expect(blockHtml(ch.blocks[0], "en")).toBe(renderMarkdown("# Chapter One"));
    expect(isFallback(ch.blocks[0], "en")).toBe(false);
  });

  it("throws when an EN block is unmarked", () => {
    const unmarked = parseChapter("# No marker here");
    expect(() => mergeChapter("01", unmarked, new Map<Lang, Block[]>())).toThrow(/unmarked/);
  });
});
