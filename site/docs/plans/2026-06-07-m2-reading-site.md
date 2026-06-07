# M2 — Reading Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static Astro reading site for the EF Mandate: all 8 chapters, an EN/JA language toggle, a commentary on/off shell, and localized UI chrome — built per-block on top of the M1 pipeline so M3–M5 can attach the commentary layer.

**Architecture:** Astro static output under `site/`. Content is loaded at build time by a small module that reuses the M1 libs (`parseChapter`, `sources`) and renders each block's Markdown to HTML, merging EN + JA by `blockId`. Each block renders **both** languages into the DOM (`data-block-id`, `.lang-en` / `.lang-ja`); a tiny vanilla script flips `data-lang` / `data-comments` on `<html>` (persisted in `localStorage`), so toggling language is instant and keeps your place (the paragraph alignment from M1). Pending JA chapters (04–08) fall back to EN with a localized banner. UI chrome strings come from an i18n catalog rendered as both-language spans toggled by the same CSS. **React, Base UI, and wagmi are NOT used in M2** — they arrive in M4 with the wallet/commentary island.

**Tech Stack:** Astro 5 (static), Tailwind CSS v4 (`@tailwindcss/vite` + `@tailwindcss/typography`), `marked` (block Markdown→HTML), TypeScript, vitest. Reuses M1 `site/src/lib/*`.

---

## Context for the implementer

- Work in `site/` (run pnpm from there). Branch `feat/commentary` is checked out — work in place, no worktree.
- M1 already built the pipeline. Reuse these exports (do NOT reimplement):
  - `site/src/lib/blocks.ts` → `parseChapter(source): Block[]`, `Block { id: string|null; marker: string|null; content: string }`.
  - `site/src/lib/sources.ts` → `loadConfig(path): {config, baseDir}`, `listChapters(dir): Map<chapter, absPath>`, `chaptersDir(baseDir, src)`, `SourceConfig`, `Config`.
- `site/config.json` declares `en` (`../source/en/chapters`) and `ja` (`../source/ja/chapters`).
- Real content state: EN chapters 01–08 are fully marked; JA 01–03 are translated + aligned (same block ids as EN); JA 04–08 are stubs (treated as pending → EN fallback).
- Markers (`<!-- block: NN-pM -->`) are excluded from `Block.content` by `parseChapter`, so rendered HTML never shows them.
- Toolchain: node v24, pnpm 10.30.3. `git` is transparently proxied — run normally. Commit messages must NOT include any AI co-author trailer.
- Pure TS modules use TDD (`pnpm exec vitest run tests/<file>`). Astro components/pages can't be unit-tested; verify them with `pnpm build` + asserting on the generated HTML in `dist/`.

## File Structure

Created under `site/`:
- `astro.config.mjs` — Astro config (Tailwind v4 vite plugin, static output)
- `src/styles/global.css` — Tailwind import + typography plugin + language/comments toggle CSS
- `src/lib/render.ts` — `renderMarkdown(md)`: block Markdown → HTML (wraps `marked`)
- `src/lib/content.ts` — `chapterTitle`, `mergeChapter`, `loadChapters`, `Chapter`, `RenderedBlock`
- `src/lib/i18n.ts` — `MESSAGES` catalog (en/ja), `Lang`, `LANGS`
- `src/components/T.astro` — render a UI string in both languages (CSS-toggled)
- `src/components/Block.astro` — one block: gutter slot + en/ja content, `data-block-id`
- `src/components/Toolbar.astro` — header: language toggle + comments on/off + title
- `src/scripts/toggles.ts` — client script: `data-lang`/`data-comments` + localStorage
- `src/layouts/Reading.astro` — page shell (imports global.css, renders Toolbar + slot)
- `src/pages/index.astro` — table of contents (localized chapter list)
- `src/pages/[chapter].astro` — per-chapter reading page (`getStaticPaths` over `loadChapters`)
- `tests/render.test.ts`, `tests/content.test.ts`, `tests/i18n.test.ts`

Modified:
- `site/package.json` — Astro deps + `dev`/`build`/`preview`/`check:astro` scripts
- `site/tsconfig.json` — extend `astro/tsconfigs/strict`, keep node/json options
- `.github/workflows/site-checks.yml` — add `astro check` + `pnpm build`
- `site/README.md` — add a "Reading site (M2)" section

---

## Task 1: Astro + Tailwind scaffold

**Files:**
- Modify: `site/package.json`
- Modify: `site/tsconfig.json`
- Create: `site/astro.config.mjs`
- Create: `site/src/styles/global.css`
- Create: `site/src/layouts/Reading.astro` (minimal here; Toolbar added in Task 5)
- Create: `site/src/pages/index.astro` (temporary placeholder, replaced in Task 7)

- [ ] **Step 1: Add Astro dependencies**

Run (from `site/`):
```bash
pnpm add astro@^5 marked@^14
pnpm add -D @astrojs/check@^0.9 @tailwindcss/vite@^4 tailwindcss@^4 @tailwindcss/typography@^0.5
```
Expected: installs succeed; `package.json` gains the deps and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Add scripts to `site/package.json`**

Edit the `"scripts"` block so it reads exactly:
```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "tsc --noEmit",
    "check:astro": "astro check",
    "test": "vitest run",
    "test:watch": "vitest",
    "blocks:inject": "tsx scripts/inject-markers.ts",
    "blocks:check": "tsx scripts/check-markers.ts",
    "anchors:build": "tsx scripts/build-anchors.ts"
  },
```

- [ ] **Step 3: Replace `site/tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "scripts", "tests"],
  "exclude": ["dist", ".astro"]
}
```

- [ ] **Step 4: Create `site/astro.config.mjs`**

```js
// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Static site. `base` stays "/" (works for local preview, IPFS, and eth.limo).
// A GitHub Pages project base path is a deploy-time concern (M6).
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 5: Create `site/src/styles/global.css`**

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

/* Language toggle: show only the active language's spans/blocks. */
[data-lang="en"] .lang-ja { display: none; }
[data-lang="ja"] .lang-en { display: none; }

/* Commentary off: hide the gutter column. */
[data-comments="off"] .gutter { display: none; }

html { scroll-behavior: smooth; }
```

- [ ] **Step 6: Create `site/src/layouts/Reading.astro`** (minimal shell; the Toolbar is added in Task 5)

```astro
---
import "../styles/global.css";
interface Props {
  title: string;
}
const { title } = Astro.props;
---
<!doctype html>
<html lang="en" data-lang="en" data-comments="off">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body class="min-h-screen bg-white text-stone-900 antialiased">
    <slot />
  </body>
</html>
```

- [ ] **Step 7: Create temporary `site/src/pages/index.astro`**

```astro
---
import Reading from "../layouts/Reading.astro";
---
<Reading title="EF Mandate">
  <main class="mx-auto max-w-2xl p-8">
    <h1 class="text-2xl font-bold">EF Mandate — reading site</h1>
    <p class="mt-2 text-stone-600">Scaffold OK.</p>
  </main>
</Reading>
```

- [ ] **Step 8: Build to verify the toolchain**

Run (from `site/`): `pnpm build`
Expected: Astro builds with no errors and writes `dist/index.html`.

Run: `grep -c "Scaffold OK" dist/index.html` → expected `1`.
Run (CSS bundled — the language-toggle rule compiles to `display:none`, which is CSS-only, not in our HTML): `grep -rqs "display:none" dist/ && echo "css-ok"` → expected `css-ok`.

- [ ] **Step 9: Confirm existing M1 tests + typecheck still pass**

Run: `pnpm test` → all M1 suites still pass (9 files).
Run: `pnpm run typecheck` → exit 0.

- [ ] **Step 10: Commit**

```bash
git add site/package.json site/pnpm-lock.yaml site/tsconfig.json site/astro.config.mjs site/src/styles/global.css site/src/layouts/Reading.astro site/src/pages/index.astro
git commit -m "feat(site): scaffold Astro + Tailwind v4 reading site"
```

---

## Task 2: Block Markdown renderer

**Files:**
- Create: `site/src/lib/render.ts`
- Test: `site/tests/render.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/lib/render";

describe("renderMarkdown", () => {
  it("renders a heading", () => {
    const html = renderMarkdown("# II. Our Role");
    expect(html).toContain("<h1");
    expect(html).toContain("II. Our Role");
  });
  it("renders bold inline", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });
  it("wraps a plain paragraph in <p>", () => {
    expect(renderMarkdown("hello world")).toContain("<p>hello world</p>");
  });
  it("returns a trimmed string (no trailing newline)", () => {
    expect(renderMarkdown("x")).toBe(renderMarkdown("x").trim());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/render.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/render").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/render.ts
import { marked } from "marked";

// Block-level Markdown -> HTML. Content is trusted (our own repo sources),
// so no sanitization is needed. Synchronous (no async extensions).
export function renderMarkdown(md: string): string {
  return (marked.parse(md, { async: false }) as string).trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/render.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/render.ts site/tests/render.test.ts
git commit -m "feat(site): block markdown renderer (marked)"
```

---

## Task 3: Content loader (merge EN/JA by blockId)

**Files:**
- Create: `site/src/lib/content.ts`
- Test: `site/tests/content.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/content.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/content").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/content.ts
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
export function mergeChapter(
  number: string,
  enBlocks: Block[],
  jaBlocks: Block[] | null
): Chapter {
  const aligned =
    jaBlocks !== null &&
    jaBlocks.length === enBlocks.length &&
    jaBlocks.every((b) => b.id !== null);

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
  const jaChapters = ja
    ? listChapters(chaptersDir(baseDir, ja))
    : new Map<string, string>();

  const out: Chapter[] = [];
  for (const [number, enFile] of enChapters) {
    const enBlocks = parseChapter(readFileSync(enFile, "utf8"));
    const jaFile = jaChapters.get(number);
    const jaBlocks = jaFile ? parseChapter(readFileSync(jaFile, "utf8")) : null;
    out.push(mergeChapter(number, enBlocks, jaBlocks));
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/content.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Sanity-check `loadChapters` against the real sources**

Run (from `site/`):
```bash
pnpm exec tsx -e "import {loadChapters} from './src/lib/content'; const c=loadChapters('config.json'); console.log(c.length, c.map(x=>x.number+':'+(x.jaPending?'pending':'ok')).join(' '))"
```
Expected: `8 01:ok 02:ok 03:ok 04:pending 05:pending 06:pending 07:pending 08:pending`.

- [ ] **Step 6: Commit**

```bash
git add site/src/lib/content.ts site/tests/content.test.ts
git commit -m "feat(site): chapter content loader (merge EN/JA by blockId)"
```

---

## Task 4: i18n catalog + T component

**Files:**
- Create: `site/src/lib/i18n.ts`
- Create: `site/src/components/T.astro`
- Test: `site/tests/i18n.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { MESSAGES, LANGS } from "../src/lib/i18n";

describe("i18n", () => {
  it("LANGS is en, ja", () => {
    expect(LANGS).toEqual(["en", "ja"]);
  });
  it("en and ja have identical key sets", () => {
    expect(Object.keys(MESSAGES.ja).sort()).toEqual(Object.keys(MESSAGES.en).sort());
  });
  it("has no empty strings", () => {
    for (const lang of LANGS) {
      for (const [k, v] of Object.entries(MESSAGES[lang])) {
        expect(v, `${lang}.${k}`).not.toBe("");
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/i18n.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/i18n").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/i18n.ts
export type Lang = "en" | "ja";

export const LANGS: Lang[] = ["en", "ja"];

export const MESSAGES = {
  en: {
    siteTitle: "EF Mandate",
    tagline: "Japanese localization with on-chain commentary",
    contents: "Contents",
    language: "Language",
    comments: "Comments",
    on: "On",
    off: "Off",
    jaPending: "This chapter isn't translated to Japanese yet — showing English.",
    home: "Home",
  },
  ja: {
    siteTitle: "EF Mandate",
    tagline: "オンチェーン・コメンタリー付き日本語ローカライズ",
    contents: "目次",
    language: "言語",
    comments: "コメント",
    on: "オン",
    off: "オフ",
    jaPending: "この章はまだ日本語訳がありません — 英語を表示しています。",
    home: "ホーム",
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)["en"];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/i18n.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create `site/src/components/T.astro`**

```astro
---
import { MESSAGES, LANGS, type MessageKey } from "../lib/i18n";
interface Props {
  k: MessageKey;
}
const { k } = Astro.props;
---
{LANGS.map((lang) => <span class={`lang lang-${lang}`}>{MESSAGES[lang][k]}</span>)}
```

- [ ] **Step 6: Commit**

```bash
git add site/src/lib/i18n.ts site/src/components/T.astro site/tests/i18n.test.ts
git commit -m "feat(site): i18n catalog + T component"
```

---

## Task 5: Toolbar + toggle script

**Files:**
- Create: `site/src/scripts/toggles.ts`
- Create: `site/src/components/Toolbar.astro`
- Modify: `site/src/layouts/Reading.astro` (created in Task 1 — add the Toolbar)

- [ ] **Step 1: Create the client toggle script `site/src/scripts/toggles.ts`**

```ts
// Client-only: reflect saved language + commentary state onto <html>, and wire buttons.
type Lang = "en" | "ja";

const root = document.documentElement;

const savedLang = (localStorage.getItem("lang") as Lang | null) ?? "en";
const savedComments = localStorage.getItem("comments") === "on" ? "on" : "off";
root.dataset.lang = savedLang;
root.dataset.comments = savedComments;

for (const el of document.querySelectorAll<HTMLElement>("[data-set-lang]")) {
  el.addEventListener("click", () => {
    const lang = el.dataset.setLang as Lang;
    root.dataset.lang = lang;
    localStorage.setItem("lang", lang);
  });
}

const commentsBtn = document.querySelector<HTMLElement>("[data-toggle-comments]");
commentsBtn?.addEventListener("click", () => {
  const next = root.dataset.comments === "on" ? "off" : "on";
  root.dataset.comments = next;
  localStorage.setItem("comments", next);
});
```

- [ ] **Step 2: Create `site/src/components/Toolbar.astro`**

```astro
---
import T from "./T.astro";
import { MESSAGES } from "../lib/i18n";
---
<header class="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
  <div class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
    <a href="/" class="font-semibold tracking-tight">{MESSAGES.en.siteTitle}</a>
    <div class="flex items-center gap-4 text-sm">
      <div class="flex items-center gap-1" aria-label="language">
        <button data-set-lang="en" class="rounded px-2 py-1 hover:bg-stone-100">EN</button>
        <button data-set-lang="ja" class="rounded px-2 py-1 hover:bg-stone-100">日本語</button>
      </div>
      <button
        data-toggle-comments
        class="rounded border border-stone-300 px-2 py-1 hover:bg-stone-100"
      >
        <T k="comments" />
      </button>
    </div>
  </div>
  <script>
    import "../scripts/toggles.ts";
  </script>
</header>
```

- [ ] **Step 3: Replace `site/src/layouts/Reading.astro`** (adds the Toolbar to the minimal shell from Task 1)

```astro
---
import "../styles/global.css";
import Toolbar from "../components/Toolbar.astro";
interface Props {
  title: string;
}
const { title } = Astro.props;
---
<!doctype html>
<html lang="en" data-lang="en" data-comments="off">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body class="min-h-screen bg-white text-stone-900 antialiased">
    <Toolbar />
    <slot />
  </body>
</html>
```

- [ ] **Step 4: Point the temporary index at the Reading layout and build**

Replace `site/src/pages/index.astro` with:
```astro
---
import Reading from "../layouts/Reading.astro";
---
<Reading title="EF Mandate">
  <main class="mx-auto max-w-3xl p-8">
    <p class="text-stone-600">Toolbar smoke test.</p>
  </main>
</Reading>
```

Run (from `site/`): `pnpm build`
Expected: builds with no errors.
Run: `grep -c 'data-set-lang="ja"' dist/index.html` → expected `1`.
Run: `grep -c 'data-toggle-comments' dist/index.html` → expected `1`.
Run: `grep -c 'lang-ja' dist/index.html` → expected `>= 1` (the `<T k="comments" />` emits a `.lang-ja` span).

- [ ] **Step 5: Commit**

```bash
git add site/src/scripts/toggles.ts site/src/components/Toolbar.astro site/src/layouts/Reading.astro site/src/pages/index.astro
git commit -m "feat(site): toolbar with language + commentary toggles"
```

---

## Task 6: Block component + chapter page

**Files:**
- Create: `site/src/components/Block.astro`
- Create: `site/src/pages/[chapter].astro`

- [ ] **Step 1: Create `site/src/components/Block.astro`**

```astro
---
import type { RenderedBlock } from "../lib/content";
interface Props {
  block: RenderedBlock;
}
const { block } = Astro.props;
const jaFallback = block.jaHtml === null;
---
<div class="block relative" data-block-id={block.blockId}>
  <div class="gutter absolute right-full top-0 mr-2 hidden w-10 text-right text-xs text-stone-400 md:block">
    <!-- commentary gutter slot (badges arrive in M5) -->
  </div>
  <div class="prose prose-stone max-w-none">
    <div class="lang lang-en" set:html={block.enHtml} />
    <div class="lang lang-ja" set:html={block.jaHtml ?? block.enHtml} data-fallback={jaFallback ? "en" : undefined} />
  </div>
</div>
```

- [ ] **Step 2: Create `site/src/pages/[chapter].astro`**

```astro
---
import Reading from "../layouts/Reading.astro";
import Block from "../components/Block.astro";
import T from "../components/T.astro";
import { loadChapters, type Chapter } from "../lib/content";

export function getStaticPaths() {
  return loadChapters().map((chapter) => ({
    params: { chapter: chapter.number },
    props: { chapter },
  }));
}

interface Props {
  chapter: Chapter;
}
const { chapter } = Astro.props;
---
<Reading title={`${chapter.title} — EF Mandate`}>
  <main class="mx-auto max-w-3xl px-4 py-10 md:px-0">
    {chapter.jaPending && (
      <p class="lang lang-ja mb-6 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <T k="jaPending" />
      </p>
    )}
    <article class="space-y-6">
      {chapter.blocks.map((block) => <Block block={block} />)}
    </article>
  </main>
</Reading>
```

- [ ] **Step 3: Build and verify the chapter pages**

Run (from `site/`): `pnpm build`
Expected: builds 8 chapter pages (`dist/01/index.html` … `dist/08/index.html`) plus `dist/index.html`.

Run: `ls dist/0*/index.html | wc -l` → expected `8`.
Run (aligned chapter has both languages): `grep -c 'data-block-id="02-p1"' dist/02/index.html` → `1`; `grep -c 'lang-en' dist/02/index.html` → `>= 16`; `grep -c 'lang-ja' dist/02/index.html` → `>= 16`.
Run (pending chapter shows the banner + EN fallback in JA slot): `grep -c 'jaPending\|日本語訳がありません' dist/04/index.html` → `>= 1`; `grep -c 'data-fallback="en"' dist/04/index.html` → `>= 1`.
Run (markers never leak into HTML): `grep -c "<!-- block:" dist/02/index.html` → `0`.

- [ ] **Step 4: Commit**

```bash
git add site/src/components/Block.astro "site/src/pages/[chapter].astro"
git commit -m "feat(site): per-chapter reading page (bilingual blocks, pending fallback)"
```

---

## Task 7: Table-of-contents home page

**Files:**
- Modify: `site/src/pages/index.astro`

- [ ] **Step 1: Replace `site/src/pages/index.astro`**

```astro
---
import Reading from "../layouts/Reading.astro";
import T from "../components/T.astro";
import { loadChapters } from "../lib/content";
const chapters = loadChapters();
---
<Reading title="EF Mandate">
  <main class="mx-auto max-w-3xl px-4 py-12 md:px-0">
    <h1 class="text-3xl font-bold tracking-tight">{`EF Mandate`}</h1>
    <p class="mt-2 text-stone-600"><T k="tagline" /></p>

    <h2 class="mt-10 text-sm font-semibold uppercase tracking-wide text-stone-500">
      <T k="contents" />
    </h2>
    <ol class="mt-4 divide-y divide-stone-150">
      {chapters.map((ch) => (
        <li>
          <a href={`/${ch.number}`} class="flex items-baseline gap-3 py-3 hover:bg-stone-50">
            <span class="w-8 shrink-0 tabular-nums text-stone-400">{ch.number}</span>
            <span class="lang lang-en">{ch.title}</span>
            <span class="lang lang-ja">{ch.jaTitle ?? ch.title}</span>
          </a>
        </li>
      ))}
    </ol>
  </main>
</Reading>
```

- [ ] **Step 2: Build and verify the TOC**

Run (from `site/`): `pnpm build`
Expected: builds without errors.
Run: `grep -c 'href="/02"' dist/index.html` → `1`.
Run: `grep -c 'href="/08"' dist/index.html` → `1`.
Run: `grep -c 'lang-ja' dist/index.html` → `>= 8` (a JA title span per chapter + toolbar).

- [ ] **Step 3: Commit**

```bash
git add site/src/pages/index.astro
git commit -m "feat(site): localized table-of-contents home page"
```

---

## Task 8: Reading styles + commentary-off shell polish

**Files:**
- Modify: `site/src/styles/global.css`

- [ ] **Step 1: Extend `site/src/styles/global.css`**

Append below the existing rules:
```css
/* Reading column + block layout. */
.block { scroll-margin-top: 5rem; }

/* Gutter is only meaningful when commentary is on; the toggle CSS above hides it
   when off. Give it a subtle hover affordance for when M5 adds badges. */
[data-comments="on"] .gutter { display: block; }

/* Fallback (EN shown in JA mode for pending chapters) gets a faint left rule. */
[data-lang="ja"] .lang-ja[data-fallback="en"] {
  border-left: 2px solid var(--color-amber-200);
  padding-left: 0.75rem;
}
```

- [ ] **Step 2: Build and verify the CSS rules are emitted**

Run (from `site/`): `pnpm build`
Expected: builds without errors.
Run (language/commentary toggle CSS compiled into the output, inlined or external): `grep -rqs "display:none" dist/ && echo "toggle-css-ok"` → expected `toggle-css-ok`.

- [ ] **Step 3: Commit**

```bash
git add site/src/styles/global.css
git commit -m "feat(site): reading layout + commentary-off CSS shell"
```

---

## Task 9: CI, type-check, README, final verification

**Files:**
- Modify: `.github/workflows/site-checks.yml`
- Modify: `site/README.md`

- [ ] **Step 1: Add Astro check + build to CI**

In `.github/workflows/site-checks.yml`, change the run steps so they read exactly:
```yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck
      - run: pnpm run check:astro
      - run: pnpm test
      - run: pnpm run blocks:check
      - run: pnpm run anchors:build
      - run: pnpm build
```

- [ ] **Step 2: Append a "Reading site (M2)" section to `site/README.md`**

```markdown
## Reading site (M2)

Run from `site/`:

- `pnpm dev` — local dev server (Astro).
- `pnpm build` — static build to `dist/` (one page per chapter + a table of contents).
- `pnpm preview` — preview the built site.
- `pnpm run check:astro` — type-check `.astro` files.

The reading view renders each block in both languages (`data-block-id`, `.lang-en` /
`.lang-ja`); a small script flips `data-lang` / `data-comments` on `<html>` (saved in
`localStorage`), so toggling language is instant and keeps your place. Chapters without a
complete Japanese translation fall back to English with a notice. UI strings live in
`src/lib/i18n.ts`.
```

- [ ] **Step 3: Validate the workflow + run the full local gate**

Run (from `site/`): `node -e "const fs=require('fs');const s=fs.readFileSync('../.github/workflows/site-checks.yml','utf8');if(!/pnpm build/.test(s)||!/check:astro/.test(s))throw new Error('bad');console.log('ci-ok')"` → `ci-ok`.
Run (from `site/`): `pnpm run typecheck` → exit 0.
Run: `pnpm run check:astro` → exit 0 (no Astro type errors).
Run: `pnpm test` → all suites pass (12 files: the 9 M1 suites + render, content, i18n).
Run: `pnpm run blocks:check` → pending info + `✓`, exit 0.
Run: `pnpm build` → builds index + 8 chapter pages.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/site-checks.yml site/README.md
git commit -m "ci(site): type-check + build the reading site; document M2"
```

---

## Self-Review notes (for the planner)

- **Spec coverage (M2 = §12 reading view + EN/JA toggle + commentary on/off + localized UI chrome + all 8 chapters):** Astro static reading view (Tasks 1, 6); per-block bilingual rendering reusing M1 (Tasks 2, 3, 6); EN/JA toggle keeping place via `data-lang` (Task 5); commentary on/off shell via `data-comments` + gutter slot (Tasks 5, 6, 8); localized UI chrome via i18n catalog + `T` (Tasks 4, 6, 7); all 8 chapters with pending JA fallback (Tasks 3, 6); TOC home (Task 7); CI build gate (Task 9).
- **Deferred to later milestones (not built here):** real comment data, gutter badges, span selection, wallet, Base UI overlays, EAS (M4/M5); IPFS/ENS/Pages deploy + base path (M6); cross-language "N comments on other languages" affordance (needs comment data).
- **Reused, not duplicated:** `parseChapter`/`Block` (blocks.ts), `loadConfig`/`listChapters`/`chaptersDir` (sources.ts). Normalization/hashing are untouched (the reading view renders raw block content; hashing stays a pipeline/anchoring concern).
- **Known choices:** client-side language toggle (both languages in the DOM) is intentional — it keeps the reader's place and showcases the paragraph alignment; page weight is ~2× per chapter, acceptable for a document. Vanilla toggle script (no React) keeps M2 light; React + Base UI + wagmi enter in M4.
- **Type-check note:** `tsc --noEmit` checks the `.ts` libs/scripts/tests (extends `astro/tsconfigs/strict`); `.astro` files are checked by `astro check`. CI runs both plus `pnpm build`.
