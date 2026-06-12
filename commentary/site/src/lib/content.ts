import { readFileSync } from "node:fs";
import { Block, parseChapter } from "./blocks";
import { renderMarkdown } from "./render";
import { loadConfig, listChapters, chaptersDir } from "./sources";
import { SOURCE_LANG, LANGS, type Lang } from "./i18n";

export interface RenderedBlock {
  blockId: string;
  order: number;
  sourceHtml: string; // EN source, always present
  translations: Partial<Record<Lang, string>>; // aligned translations only
}

export interface Chapter {
  number: string;
  sourceTitle: string;
  translations: Partial<Record<Lang, { title: string }>>; // present ⇔ aligned (not pending)
  blocks: RenderedBlock[];
}

/** Plain-text title from a heading block's content (strips leading `#`s). */
export function chapterTitle(headingBlockContent: string): string {
  return headingBlockContent.replace(/^#+\s*/, "").trim();
}

/** HTML to render for `lang`: the aligned translation, else the EN source. */
export const blockHtml = (b: RenderedBlock, lang: Lang): string =>
  lang === SOURCE_LANG ? b.sourceHtml : (b.translations[lang] ?? b.sourceHtml);

/** Chapter title for `lang`, falling back to the EN source title. */
export const titleFor = (ch: Chapter, lang: Lang): string =>
  lang === SOURCE_LANG ? ch.sourceTitle : (ch.translations[lang]?.title ?? ch.sourceTitle);

/** True when `lang` has no aligned translation for this chapter (showing EN). */
export const isPending = (ch: Chapter, lang: Lang): boolean =>
  lang !== SOURCE_LANG && !(lang in ch.translations);

/** True when this block is falling back to the EN source for `lang`. */
export const isFallback = (b: RenderedBlock, lang: Lang): boolean =>
  lang !== SOURCE_LANG && !(lang in b.translations);

/**
 * Merge an EN chapter with its translations, keyed by language. A translation is
 * "aligned" only when it has the same number of blocks as EN, every block is
 * uniquely marked, AND its id set matches EN's exactly. Unaligned translations
 * are omitted (the chapter falls back to EN for that language = "pending").
 */
export function mergeChapter(
  number: string,
  enBlocks: Block[],
  translations: Map<Lang, Block[]>,
): Chapter {
  enBlocks.forEach((b, i) => {
    if (b.id === null) {
      throw new Error(`EN chapter ${number} block #${i} is unmarked (run blocks:inject)`);
    }
  });

  // Per language: a blockId -> content map, only when that language is aligned.
  const alignedById = new Map<Lang, Map<string, string>>();
  for (const [lang, blocks] of translations) {
    const ids = new Set(blocks.map((b) => b.id).filter((x): x is string => x !== null));
    const aligned =
      blocks.length === enBlocks.length &&
      ids.size === blocks.length &&
      enBlocks.every((b) => b.id !== null && ids.has(b.id));
    if (!aligned) continue;
    const byId = new Map<string, string>();
    for (const b of blocks) byId.set(b.id as string, b.content);
    alignedById.set(lang, byId);
  }

  const blocks: RenderedBlock[] = enBlocks.map((b, i) => {
    const id = b.id as string;
    const blockTranslations: Partial<Record<Lang, string>> = {};
    for (const [lang, byId] of alignedById) {
      const content = byId.get(id);
      if (content !== undefined) blockTranslations[lang] = renderMarkdown(content);
    }
    return {
      blockId: id,
      order: i,
      sourceHtml: renderMarkdown(b.content),
      translations: blockTranslations,
    };
  });

  const chapterTranslations: Partial<Record<Lang, { title: string }>> = {};
  for (const [lang, byId] of alignedById) {
    const firstContent = byId.get(enBlocks[0].id as string);
    if (firstContent !== undefined)
      chapterTranslations[lang] = { title: chapterTitle(firstContent) };
  }

  return {
    number,
    sourceTitle: chapterTitle(enBlocks[0].content),
    translations: chapterTranslations,
    blocks,
  };
}

/** Load + merge every chapter from config (EN authority). Used at build time. */
export function loadChapters(configPath = "config.json"): Chapter[] {
  const { config, baseDir } = loadConfig(configPath);
  const en = config.sources.find((s) => s.lang === SOURCE_LANG);
  if (!en) throw new Error(`config must include a '${SOURCE_LANG}' source`);

  // Known translation languages (in i18n LANGS) -> their chapter-number -> file map.
  const known = new Set<string>(LANGS);
  const translationChapters = new Map<Lang, Map<string, string>>();
  for (const src of config.sources) {
    if (src.lang === SOURCE_LANG) continue;
    if (!known.has(src.lang)) {
      console.warn(`config source lang "${src.lang}" is not in i18n LANGS; skipping`);
      continue;
    }
    translationChapters.set(src.lang as Lang, listChapters(chaptersDir(baseDir, src)));
  }

  const enChapters = listChapters(chaptersDir(baseDir, en));
  const out: Chapter[] = [];
  for (const [number, enFile] of enChapters) {
    const enBlocks = parseChapter(readFileSync(enFile, "utf8"));
    const perLang = new Map<Lang, Block[]>();
    for (const [lang, chapterMap] of translationChapters) {
      const file = chapterMap.get(number);
      if (file) perLang.set(lang, parseChapter(readFileSync(file, "utf8")));
    }
    out.push(mergeChapter(number, enBlocks, perLang));
  }
  return out;
}
