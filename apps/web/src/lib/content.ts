import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Block, parseChapter } from "./blocks";
import { renderMarkdown } from "./render";
import { loadConfig, listChapters, chaptersDir } from "./sources";
import { SOURCE_LANG, LANGS, type Lang } from "./i18n";

export interface RenderedBlock {
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
 * Merge an EN chapter with its translations. A translation FILE existing is
 * enough — blocks align by position (block i ↔ EN block i): EN blocks with no
 * translated counterpart fall back to EN, and extra translation blocks (beyond
 * EN's count, e.g. a translator footnote) are dropped. A chapter is "pending"
 * for a language only when no translation file exists at all.
 */
export function mergeChapter(
  number: string,
  enBlocks: Block[],
  translations: Map<Lang, Block[]>,
): Chapter {
  const blocks: RenderedBlock[] = enBlocks.map((b, i) => {
    const blockTranslations: Partial<Record<Lang, string>> = {};
    for (const [lang, tBlocks] of translations) {
      const t = tBlocks[i];
      if (t && t.content.trim().length > 0) blockTranslations[lang] = renderMarkdown(t.content);
    }
    return { order: i, sourceHtml: renderMarkdown(b.content), translations: blockTranslations };
  });

  const chapterTranslations: Partial<Record<Lang, { title: string }>> = {};
  for (const [lang, tBlocks] of translations) {
    const first = tBlocks[0];
    const titleSource = first && first.content.trim().length > 0 ? first.content : enBlocks[0].content;
    chapterTranslations[lang] = { title: chapterTitle(titleSource) };
  }

  return {
    number,
    sourceTitle: chapterTitle(enBlocks[0].content),
    translations: chapterTranslations,
    blocks,
  };
}

// Anchor the default config to this module, not process.cwd(), so builds work
// regardless of the invoking directory. Walk up from the module's own location
// (rather than hardcoding a fixed "../../") because Astro's SSR build bundles
// this module into a relocated chunk under dist/.prerender/chunks/ — a static
// relative offset resolves to the wrong depth there. Since dist/ is always
// nested under apps/web/, climbing until config.json is found converges on the
// real file regardless of how deep the bundler places the chunk.
function findDefaultConfig(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "config.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate config.json above ${startDir}`);
}
const DEFAULT_CONFIG = findDefaultConfig(dirname(fileURLToPath(import.meta.url)));

// Content is immutable within a production build; per-page calls reuse one parse.
// Dev/test skip the cache so markdown edits show on refresh.
const chapterCache = new Map<string, Chapter[]>();

/** Load + merge every chapter from config (EN authority). Used at build time. */
export function loadChapters(configPath = DEFAULT_CONFIG): Chapter[] {
  const cached = import.meta.env?.PROD ? chapterCache.get(configPath) : undefined;
  if (cached) return cached;
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
    if (enBlocks.length === 0) {
      throw new Error(`chapter ${number}: no content blocks in ${enFile}`);
    }
    const perLang = new Map<Lang, Block[]>();
    for (const [lang, chapterMap] of translationChapters) {
      const file = chapterMap.get(number);
      if (file) perLang.set(lang, parseChapter(readFileSync(file, "utf8")));
    }
    out.push(mergeChapter(number, enBlocks, perLang));
  }
  if (import.meta.env?.PROD) chapterCache.set(configPath, out);
  return out;
}
