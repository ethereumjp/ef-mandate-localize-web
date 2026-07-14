import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseChapter, type Block } from "../src/lib/blocks";
import { renderMarkdown } from "../src/lib/render";
import {
  mergeChapter,
  blockHtml,
  titleFor,
  isPending,
  isFallback,
  loadChapters,
} from "../src/lib/content";
import type { Lang } from "../src/lib/i18n";

const en = parseChapter("# Chapter One\n\nEnglish body."); // 2 blocks

describe("mergeChapter", () => {
  it("uses the translation block-by-block when the file is present", () => {
    const ja = parseChapter("# 第一章\n\n日本語の本文。"); // 2 blocks
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>([["ja", ja]]));
    expect(ch.sourceTitle).toBe("Chapter One");
    expect(ch.translations.ja?.title).toBe("第一章");
    expect(isPending(ch, "ja")).toBe(false);
    expect(blockHtml(ch.blocks[1], "ja")).toBe(renderMarkdown("日本語の本文。"));
    expect(isFallback(ch.blocks[1], "ja")).toBe(false);
  });

  it("falls back to EN per block when the translation is shorter (still not pending)", () => {
    const jaShort = parseChapter("# 第一章のみ"); // 1 block < EN's 2
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>([["ja", jaShort]]));
    expect(isPending(ch, "ja")).toBe(false); // a file exists → the chapter is translated
    expect(blockHtml(ch.blocks[0], "ja")).toBe(renderMarkdown("# 第一章のみ"));
    expect(isFallback(ch.blocks[0], "ja")).toBe(false);
    expect(blockHtml(ch.blocks[1], "ja")).toBe(renderMarkdown("English body.")); // no JA[1]
    expect(isFallback(ch.blocks[1], "ja")).toBe(true);
  });

  it("drops extra translation blocks beyond the EN block count", () => {
    const jaLong = parseChapter("# 第一章\n\n本文。\n\n[^1]: 訳者脚注。"); // 3 blocks > EN's 2
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>([["ja", jaLong]]));
    expect(ch.blocks).toHaveLength(2); // EN drives the block count
    expect(blockHtml(ch.blocks[1], "ja")).toBe(renderMarkdown("本文。"));
    expect(isPending(ch, "ja")).toBe(false);
  });

  it("treats a missing language (no file) as pending → EN fallback", () => {
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>());
    expect(isPending(ch, "ja")).toBe(true);
    expect(titleFor(ch, "ja")).toBe("Chapter One");
    expect(blockHtml(ch.blocks[1], "ja")).toBe(renderMarkdown("English body."));
    expect(isFallback(ch.blocks[1], "ja")).toBe(true);
  });

  it("never reports pending/fallback for the source language", () => {
    const ja = parseChapter("# 第一章\n\n日本語の本文。");
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>([["ja", ja]]));
    expect(isPending(ch, "en")).toBe(false);
    expect(blockHtml(ch.blocks[0], "en")).toBe(renderMarkdown("# Chapter One"));
    expect(isFallback(ch.blocks[0], "en")).toBe(false);
  });
});

describe("loadChapters", () => {
  it("names the offending file when an EN chapter is empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "content-"));
    mkdirSync(join(dir, "en"));
    writeFileSync(join(dir, "en", "01-empty.md"), "\n");
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({ sources: [{ lang: "en", path: "en" }] }),
    );
    expect(() => loadChapters(join(dir, "config.json"))).toThrow(/01-empty\.md/);
  });
});
