# i18n 一般化（`ja` 決め打ち → N 言語）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** レンダリング層に焼き込まれた「EN/JA 二言語」前提を、`Lang` を増やすだけで N 言語に対応できる構造へ一般化する（en+ja の表示挙動は不変）。

**Architecture:** EN を原文（`SOURCE_LANG`）に固定したまま、翻訳側の単一 `ja*` スロットを `Partial<Record<Lang, …>>` マップへ置換。フォールバック判定を `content.ts` の純関数（`blockHtml`/`titleFor`/`isPending`/`isFallback`）に集約し、各コンポーネントの `lang === "ja" ? …` 三項分岐を消す。ルートは EN=`/`、他言語=動的 `[lang].astro`。UI 文言は `t()` で EN フォールバック、CSS の言語出し分けは `LANGS` から生成。

**Tech Stack:** Astro 6 / React 19 / TypeScript 5.6 / vitest 2 / Tailwind 4。全コマンドは `site/` で実行。

**Spec:** `site/docs/specs/2026-06-11-i18n-generalization-design.md`

---

## ⚠️ Preconditions（実装前に必ず）

1. **作業前の未コミット変更を確認**：`git status -s`。本プラン着手時点で `site/src/components/comments/CommentCard.tsx`・`CommentThread.tsx`・`site/src/styles/global.css` に他作業の未コミット変更がある。**Task 4（global.css）と Task 5（CommentCard.tsx）は同じファイルを触る**ため、先にこれらを commit / stash して衝突を避けること。
2. 本リファクタは **言語を追加しない**（`Lang = "en" | "ja"` のまま）。目的は構造の一般化で、出力は en+ja とも従来と等価であること（Task 6 で確認）。実際の言語追加は spec §12 の手順で後続作業。
3. すべて `site/` ディレクトリで作業：`cd site` 済みを前提にコマンドを記載。

## File Structure

| ファイル | 責務 | 操作 |
|---|---|---|
| `src/lib/i18n.ts` | 言語定義・ルート導出・UI 文言と `t()` フォールバック | Modify |
| `src/lib/content.ts` | コンテンツモデル・マージ・フォールバックヘルパ | Modify（型と関数を刷新） |
| `src/components/T.astro` | UI 文言の全言語出力 | Modify（`t()` 化） |
| `src/components/Toolbar.astro` / `SiteMeta.astro` | `MESSAGES[lang]` 参照 | Modify（`t()` 化） |
| `src/components/Block.astro` / `Index.astro` / `Document.astro` | コンテンツ表示 | Modify（ヘルパ化） |
| `src/layouts/Reading.astro` | 言語出し分け CSS の生成 | Modify |
| `src/styles/global.css` | 旧二言語 CSS の削除 | Modify |
| `src/pages/index.astro` | EN ページ（`/`） | Modify（title を `t()` 化） |
| `src/pages/[lang].astro` | 翻訳言語ページ（`/<lang>`） | Create |
| `src/pages/ja.astro` | 旧 JA 固定ページ | Delete |
| `src/components/comments/CommentCard.tsx` | 日付ロケール | Modify |
| `tests/i18n.test.ts` / `tests/content.test.ts` | 純関数の単体テスト | Create |

---

## Task 1: i18n プリミティブ＋UI 文言の `t()` 化＋`pending` リネーム

**Files:**
- Modify: `src/lib/i18n.ts`
- Modify: `src/components/T.astro`, `src/components/Toolbar.astro`, `src/components/SiteMeta.astro`, `src/components/Document.astro`（`<T>` の 1 行のみ）
- Test: `tests/i18n.test.ts`

このタスク後も `content.ts` は未変更。`Document.astro` の `ch.jaPending`（旧フィールド）参照は残るが型は通る。

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/i18n.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { langRoute, resolveMessage, t } from "../src/lib/i18n";

describe("langRoute", () => {
  it("maps the source language to /", () => {
    expect(langRoute("en")).toBe("/");
  });
  it("maps other languages to /<code>", () => {
    expect(langRoute("ja")).toBe("/ja");
  });
});

describe("resolveMessage", () => {
  const table = { en: { a: "A", b: "B" }, fr: { a: "Af" } };
  it("returns the language's value when present", () => {
    expect(resolveMessage(table, "en", "fr", "a")).toBe("Af");
  });
  it("falls back to the fallback language when the key is missing", () => {
    expect(resolveMessage(table, "en", "fr", "b")).toBe("B");
  });
  it("falls back when the language is absent entirely", () => {
    expect(resolveMessage(table, "en", "de", "a")).toBe("A");
  });
});

describe("t", () => {
  it("returns the translated UI string, falling back to source", () => {
    expect(t("ja", "comments")).toBe("コメント");
    expect(t("en", "comments")).toBe("Comments");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- i18n`
Expected: FAIL — `langRoute`/`resolveMessage`/`t` is not exported（または import エラー）。

- [ ] **Step 3: `src/lib/i18n.ts` を実装**

ファイル全体を以下で置換:

```ts
export type Lang = "en" | "ja";

export const LANGS: Lang[] = ["en", "ja"];

/** The authoritative source language. All others are translations of it. */
export const SOURCE_LANG: Lang = "en";

/** Route for a language: the source language lives at "/", others at "/<code>". */
export function langRoute(code: Lang): string {
  return code === SOURCE_LANG ? "/" : `/${code}`;
}

/** Language switcher options (endonym label). Add a row per new language. */
export const LANG_OPTIONS: { code: Lang; label: string; route: string }[] = [
  { code: "en", label: "English", route: langRoute("en") },
  { code: "ja", label: "日本語", route: langRoute("ja") },
];

/** EN is the only complete, required dictionary; other languages may be partial. */
const EN_MESSAGES = {
  siteTitle: "EF Mandate",
  index: "Chapters",
  backToIndex: "Back to index",
  language: "Language",
  comments: "Comments",
  pastVersion: "Comment for past version",
  statusReanchored: "Re-anchored",
  statusNeedsReview: "Needs review",
  statusOrphaned: "Block removed",
  reply: "Reply",
  threadTitle: "Comments",
  noComments: "No comments on this block yet.",
  needsReviewTitle: "Needs review (text changed)",
  on: "On",
  off: "Off",
  pending: "This chapter isn't translated yet — showing the original (English).",
  home: "Home",
  sourceCode: "Source code",
  originalPdf: "Original PDF",
  projectNote: "A community localization of the EF Mandate — not an official EF translation.",
} as const;

export type MessageKey = keyof typeof EN_MESSAGES;

type MessageTable = { en: Record<MessageKey, string> } & Partial<
  Record<Lang, Partial<Record<MessageKey, string>>>
>;

export const MESSAGES: MessageTable = {
  en: EN_MESSAGES,
  ja: {
    siteTitle: "EF Mandate",
    index: "目次",
    backToIndex: "目次へ戻る",
    language: "言語",
    comments: "コメント",
    pastVersion: "過去のバージョンに対するコメント",
    statusReanchored: "再アンカリング",
    statusNeedsReview: "要確認",
    statusOrphaned: "ブロックが削除されました",
    reply: "返信",
    threadTitle: "コメント",
    noComments: "このブロックにはまだコメントがありません。",
    needsReviewTitle: "要確認（本文が変更されました）",
    on: "オン",
    off: "オフ",
    pending: "この章はまだ翻訳されていません — 原文（英語）を表示しています。",
    home: "ホーム",
    sourceCode: "ソースコード",
    originalPdf: "原文PDF",
    projectNote:
      "EF Mandate のコミュニティによる日本語ローカライズです（EF 公式翻訳ではありません）。",
  },
};

/**
 * Look up `key` for `lang` in `table`, falling back to `fallbackLang`'s entry
 * when the language or key is missing. Generic over the table for testability.
 */
export function resolveMessage(
  table: Partial<Record<string, Partial<Record<string, string>>>>,
  fallbackLang: string,
  lang: string,
  key: string,
): string {
  return table[lang]?.[key] ?? table[fallbackLang]?.[key] ?? key;
}

/** Translate UI message `k` for `lang`, falling back to the source language. */
export const t = (lang: Lang, k: MessageKey): string =>
  resolveMessage(MESSAGES, SOURCE_LANG, lang, k);
```

- [ ] **Step 4: UI 文言の消費側を `t()` 化（型を通すため同一コミット）**

`src/components/T.astro` 全体:

```astro
---
import { LANGS, t, type MessageKey } from "../lib/i18n";
interface Props {
  k: MessageKey;
}
const { k } = Astro.props;
---
{LANGS.map((lang) => <span class={`lang lang-${lang}`}>{t(lang, k)}</span>)}
```

`src/components/Toolbar.astro` の冒頭 import（2行目）を:

```astro
import { t, LANG_OPTIONS } from "../lib/i18n";
```

に変更し、本文中の参照を置換:
- `>{MESSAGES.en.siteTitle}</a` → `>{t("en", "siteTitle")}</a`
- `aria-label={MESSAGES[lang].language}` → `aria-label={t(lang, "language")}`
- `aria-label={MESSAGES[lang].comments}` → `aria-label={t(lang, "comments")}`

`src/components/SiteMeta.astro` の冒頭 import（2行目）を:

```astro
import { t } from "../lib/i18n";
```

に変更し、`const m = MESSAGES[lang];` の行を**削除**、参照を置換:
- `aria-label={m.sourceCode}` → `aria-label={t(lang, "sourceCode")}`
- `aria-label={m.originalPdf}` → `aria-label={t(lang, "originalPdf")}`
- `<p>{m.projectNote}</p>` → `<p>{t(lang, "projectNote")}</p>`

`src/components/Document.astro` の `<T k="jaPending" />`（61行目付近）を:

```astro
<T k="pending" />
```

に変更（59行目の `lang === "ja" && ch.jaPending` はこのタスクでは触らない）。

- [ ] **Step 5: テストと型チェックが通ることを確認**

Run: `npm test -- i18n && npm run check:astro`
Expected: テスト PASS、`astro check` エラー 0。

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n.ts src/components/T.astro src/components/Toolbar.astro src/components/SiteMeta.astro src/components/Document.astro tests/i18n.test.ts
git commit -m "feat(site): generalize i18n messages with t() fallback; rename jaPending -> pending"
```

---

## Task 2: コンテンツモデルの N 言語化＋ヘルパ＋消費側移行

**Files:**
- Modify: `src/lib/content.ts`
- Modify: `src/components/Block.astro`, `src/components/Index.astro`, `src/components/Document.astro`
- Test: `tests/content.test.ts`

型を変えると 3 コンポーネントが同時に壊れるため、型・ヘルパ・マージと消費側更新を**1 コミットで green** にする。

- [ ] **Step 1: 失敗するテストを書く**

Create `tests/content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseChapter, type Block } from "../src/lib/blocks";
import { renderMarkdown } from "../src/lib/render";
import { mergeChapter, blockHtml, titleFor, isPending, isFallback } from "../src/lib/content";
import type { Lang } from "../src/lib/i18n";

const en = parseChapter("<!-- block: 01-h -->\n# Chapter One\n\n<!-- block: 01-p -->\nEnglish body.");
const jaAligned = parseChapter("<!-- block: 01-h -->\n# 第一章\n\n<!-- block: 01-p -->\n日本語の本文。");
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- content`
Expected: FAIL — `mergeChapter` の新シグネチャ未実装 / `blockHtml` 等が未 export。

- [ ] **Step 3: `src/lib/content.ts` を実装**

ファイル全体を以下で置換:

```ts
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
    return { blockId: id, order: i, sourceHtml: renderMarkdown(b.content), translations: blockTranslations };
  });

  const chapterTranslations: Partial<Record<Lang, { title: string }>> = {};
  for (const [lang, byId] of alignedById) {
    const firstContent = byId.get(enBlocks[0].id as string);
    if (firstContent !== undefined) chapterTranslations[lang] = { title: chapterTitle(firstContent) };
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- content`
Expected: 5 テスト PASS。

- [ ] **Step 5: 消費側 3 コンポーネントを移行（型を通すため同一コミット）**

`src/components/Block.astro` 全体:

```astro
---
import type { RenderedBlock } from "../lib/content";
import { blockHtml, isFallback } from "../lib/content";
import type { Lang } from "../lib/i18n";
interface Props {
  block: RenderedBlock;
  lang: Lang;
}
const { block, lang } = Astro.props;
const html = blockHtml(block, lang);
const fallback = isFallback(block, lang);
---
<div class="block relative" data-block-id={block.blockId}>
  <div
    class="prose prose-stone max-w-none dark:prose-invert"
    data-fallback={fallback ? "en" : undefined}
    set:html={html}
  />
</div>
```

`src/components/Index.astro` の冒頭 import に `titleFor` を追加し、本文の三項を置換:
- 2行目に追記: `import { titleFor } from "../lib/content";`
- `{lang === "ja" ? (ch.jaTitle ?? ch.title) : ch.title}` → `{titleFor(ch, lang)}`

`src/components/Document.astro`:
- import 行（6行目）を `import { loadChapters, isPending } from "../lib/content";` に変更。
- 条件（59行目付近）`{lang === "ja" && ch.jaPending && (` → `{isPending(ch, lang) && (`

- [ ] **Step 6: 他に content.ts の旧 API 依存が無いことを確認**

Run: `grep -rn "jaHtml\|jaTitle\|jaPending\|enHtml" src`
Expected: 0 件（旧フィールド参照が残っていない）。

Run: `npm run check:astro`
Expected: エラー 0。

- [ ] **Step 7: Commit**

```bash
git add src/lib/content.ts src/components/Block.astro src/components/Index.astro src/components/Document.astro tests/content.test.ts
git commit -m "feat(site): N-language content model with source+translations map and fallback helpers"
```

---

## Task 3: ルーティングを動的 `[lang].astro` に一般化

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/pages/[lang].astro`
- Delete: `src/pages/ja.astro`

- [ ] **Step 1: `index.astro` のタイトルを `t()` 化**

`src/pages/index.astro` 全体:

```astro
---
import Reading from "../layouts/Reading.astro";
import Document from "../components/Document.astro";
import { t } from "../lib/i18n";
---
<Reading title={t("en", "siteTitle")} lang="en">
  <Document lang="en" />
</Reading>
```

- [ ] **Step 2: 動的ルート `[lang].astro` を作成**

Create `src/pages/[lang].astro`:

```astro
---
import Reading from "../layouts/Reading.astro";
import Document from "../components/Document.astro";
import { LANGS, SOURCE_LANG, LANG_OPTIONS, t, type Lang } from "../lib/i18n";

export function getStaticPaths() {
  return LANGS.filter((l) => l !== SOURCE_LANG).map((lang) => ({ params: { lang } }));
}

const lang = Astro.params.lang as Lang;
const endonym = LANG_OPTIONS.find((o) => o.code === lang)?.label ?? lang;
const title = `${t(lang, "siteTitle")} · ${endonym}`;
---
<Reading title={title} lang={lang}>
  <Document lang={lang} />
</Reading>
```

- [ ] **Step 3: 旧 `ja.astro` を削除**

```bash
git rm src/pages/ja.astro
```

- [ ] **Step 4: ビルドして出力ルートを確認**

Run: `npm run build`
Expected: 成功。`/` と `/ja` の両方が生成される。

Run: `test -f dist/index.html && test -f dist/ja/index.html && echo OK`
Expected: `OK`（両ページ存在）。

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/pages/[lang].astro
git commit -m "feat(site): dynamic [lang] route; EN at /, translations at /<lang>"
```

---

## Task 4: 言語出し分け CSS を `LANGS` から生成

**Files:**
- Modify: `src/layouts/Reading.astro`
- Modify: `src/styles/global.css`

⚠️ `global.css` は Preconditions の未コミット変更対象。先に reconcile 済みであること。

- [ ] **Step 1: `Reading.astro` に生成 `<style>` を追加**

`src/layouts/Reading.astro` のフロントマター（`---` 内）の import に `LANGS` を加え、`langStyle` を算出:

```astro
import "../styles/global.css";
import Toolbar from "../components/Toolbar.astro";
import { LANGS, type Lang } from "../lib/i18n";
interface Props {
  title: string;
  lang: Lang;
}
const { title, lang } = Astro.props;
// Show only the active language's <T> spans. Generated from LANGS so it scales
// to N languages. `is:inline` keeps Astro from scoping these global selectors.
const langStyle = LANGS.map((l) => `[data-lang="${l}"] .lang:not(.lang-${l}){display:none}`).join("\n");
```

`<head>` 内、`<title>{title}</title>` の直後に追加:

```astro
    <title>{title}</title>
    <style is:inline set:html={langStyle}></style>
```

- [ ] **Step 2: `global.css` の旧二言語ルールを削除**

`src/styles/global.css` から以下のブロックを**削除**:

```css
/* Language toggle: show only the active language's spans/blocks. */
[data-lang="en"] .lang-ja {
    display: none;
}
[data-lang="ja"] .lang-en {
    display: none;
}
```

- [ ] **Step 3: ビルドして生成 CSS を確認**

Run: `npm run build && grep -o 'data-lang="ja"] .lang:not(.lang-ja){display:none}' dist/index.html`
Expected: 一致行が出力される（生成スタイルが head にインライン化されている）。

- [ ] **Step 4: 出し分け挙動の目視確認（任意だが推奨）**

`dist/index.html`（`data-lang="en"`）で `.lang-ja` が非表示、`dist/ja/index.html`（`data-lang="ja"`）で `.lang-en` が非表示になること。`/code-review` 不要。`npm run preview` で `/` と `/ja` を開き、ツールバー等の文言が 1 言語だけ表示されることを確認。

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Reading.astro src/styles/global.css
git commit -m "feat(site): generate language show/hide CSS from LANGS (scales to N langs)"
```

---

## Task 5: コメントの日付ロケール脱 `ja` 決め打ち

**Files:**
- Modify: `src/components/comments/CommentCard.tsx`

⚠️ Preconditions の未コミット変更対象。先に reconcile 済みであること。

- [ ] **Step 1: ロケール三項を `lang` 直接渡しに置換**

`src/components/comments/CommentCard.tsx`（61行目付近）:

```tsx
{new Date(c.time * 1000).toLocaleDateString(
  lang === "ja" ? "ja-JP" : "en-US",
)}
```

を以下に変更（`lang` は BCP-47 言語コードとして有効）:

```tsx
{new Date(c.time * 1000).toLocaleDateString(lang)}
```

- [ ] **Step 2: 型チェック**

Run: `npm run check:astro`
Expected: エラー 0。

- [ ] **Step 3: Commit**

```bash
git add src/components/comments/CommentCard.tsx
git commit -m "feat(site): derive comment date locale from lang code (drop ja hardcode)"
```

---

## Task 6: 総合検証（型・テスト・lint・fmt・ビルド・等価性）

**Files:** なし（検証のみ）

- [ ] **Step 1: 全チェックを実行**

```bash
npm run check:astro && npm run typecheck && npm test && npm run lint && npm run fmt:check && npm run build
```

Expected: すべて成功（`astro check` 0 エラー、vitest 全 PASS、oxlint 出力なし、fmt 差分なし、build 成功）。

- [ ] **Step 2: 旧 `ja` 決め打ちが残っていないことを確認**

Run: `grep -rn "jaHtml\|jaTitle\|jaPending\|\"ja-JP\"\|\"en-US\"\|\[data-lang=\\\"en\\\"\] .lang-ja" src`
Expected: 0 件。

- [ ] **Step 3: en+ja 出力の等価性を目視（リファクタの不変条件）**

`npm run preview` で `/`（EN）と `/ja`（JA）を開き、リファクタ前と同じく:
- 目次・本文・ツールバー文言が各言語で正しく表示される。
- 未訳章があれば pending バナー（`pending` 文言）が出て本文が EN にフォールバックする。
- 言語セレクタで `/` ⇔ `/ja` を行き来でき、ハッシュ（読み位置）が維持される。

- [ ] **Step 4: 完了**

実装完了。`site/docs/specs/2026-06-11-i18n-generalization-design.md` §12 の手順で、以降は言語を 1 つ追加して（`Lang`/`LANGS`/`LANG_OPTIONS` に行追加＋`config.json` ソース追加＋md 配置）動的生成を実地確認するとよい。

---

## Self-Review 記録

- **Spec coverage:** §3 データモデル→Task 2 / §4 ヘルパ→Task 2 / §5 マージ・ロード→Task 2 / §6 i18n→Task 1 / §7 CSS→Task 4 / §8 ルート→Task 3 / §9 コンポーネント置換→Task 1・2・5 / §10 エラー処理→Task 2（`en` 必須 throw・未登録 lang は warn skip）/ §11 テスト→Task 1・2 / §12 言語追加→Task 6 Step 4。全節に対応タスクあり。
- **Type consistency:** `SOURCE_LANG`/`LANGS`/`Lang` は i18n.ts 定義を content.ts・pages・Reading が import（循環なし：i18n は content を参照しない）。`MessageKey` は `EN_MESSAGES` リテラル由来で MESSAGES と非循環。ヘルパ名 `blockHtml`/`titleFor`/`isPending`/`isFallback`・`mergeChapter(number, enBlocks, translations: Map<Lang, Block[]>)` はテスト・消費側で一致。
- **Placeholder scan:** TODO/TBD なし。全コードステップに完全なコードを記載。
