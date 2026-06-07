import { readFileSync } from "node:fs";
import { Block, parseChapter } from "./blocks";
import { renderMarkdown } from "./render";
import { loadConfig, listChapters, chaptersDir } from "./sources";

export interface RenderedBlock {
  blockId: string;
  order: number;
  enHtml: string;
  jaHtml: string | null;
}

export interface Chapter {
  number: string;
  title: string;
  jaTitle: string | null;
  jaPending: boolean;
  blocks: RenderedBlock[];
}

/** Plain-text title from a heading block's content (strips leading `#`s). */
export function chapterTitle(headingBlockContent: string): string {
  return headingBlockContent.replace(/^#+\s*/, "").trim();
}

/** Merge an EN chapter with its (possibly pending) JA counterpart, by blockId. */
export function mergeChapter(number: string, enBlocks: Block[], jaBlocks: Block[] | null): Chapter {
  // A translation chapter is "aligned" only when it has the same number of
  // blocks as EN, every JA block is uniquely marked, AND its id set matches
  // EN's exactly. (Count + uniqueness + EN ⊆ JA ⇒ set equality.) Otherwise the
  // chapter is pending and falls back to English.
  const jaIds = new Set((jaBlocks ?? []).map((b) => b.id).filter((x): x is string => x !== null));
  const aligned =
    jaBlocks !== null &&
    jaBlocks.length === enBlocks.length &&
    jaIds.size === jaBlocks.length &&
    enBlocks.every((b) => b.id !== null && jaIds.has(b.id));

  const jaById = new Map<string, string>();
  if (aligned) {
    for (const b of jaBlocks as Block[]) jaById.set(b.id as string, b.content);
  }

  const blocks: RenderedBlock[] = enBlocks.map((b, i) => {
    if (b.id === null) {
      throw new Error(`EN chapter ${number} block #${i} is unmarked (run blocks:inject)`);
    }
    const jaContent = jaById.get(b.id);
    return {
      blockId: b.id,
      order: i,
      enHtml: renderMarkdown(b.content),
      jaHtml: jaContent !== undefined ? renderMarkdown(jaContent) : null,
    };
  });

  const firstJa = jaById.get(enBlocks[0].id as string);
  return {
    number,
    title: chapterTitle(enBlocks[0].content),
    jaTitle: firstJa !== undefined ? chapterTitle(firstJa) : null,
    jaPending: !aligned,
    blocks,
  };
}

/** Load + merge every chapter from config (EN authority). Used at build time. */
export function loadChapters(configPath = "config.json"): Chapter[] {
  const { config, baseDir } = loadConfig(configPath);
  const en = config.sources.find((s) => s.lang === "en");
  if (!en) throw new Error("config must include an 'en' source");
  const ja = config.sources.find((s) => s.lang === "ja");

  const enChapters = listChapters(chaptersDir(baseDir, en));
  const jaChapters = ja ? listChapters(chaptersDir(baseDir, ja)) : new Map<string, string>();

  const out: Chapter[] = [];
  for (const [number, enFile] of enChapters) {
    const enBlocks = parseChapter(readFileSync(enFile, "utf8"));
    const jaFile = jaChapters.get(number);
    const jaBlocks = jaFile ? parseChapter(readFileSync(jaFile, "utf8")) : null;
    out.push(mergeChapter(number, enBlocks, jaBlocks));
  }
  return out;
}
