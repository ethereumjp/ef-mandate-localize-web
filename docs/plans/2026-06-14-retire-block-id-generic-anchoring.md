# Retire block-ID — generic anchoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire block-ID. The translation site renders natural HTML and the widget anchors it the same way as any third-party host (generated `rootSelector` + `containerHash` + TextQuote), so `feat/commentary` differs from `main` only within `commentary/`.

**Architecture:** `@commentary/core` is already generic and **unchanged**. The widget read path (`display.ts`) gains a `resolveContainer`/`findByQuote` fallback and keys projection by the *resolved element* (so stale/empty selectors still anchor). The site stops emitting `data-block-id`, aligns EN↔translation **by position**, and the source markers + `build.py` strip revert to `main`. The marker machinery (`lib/{inject,ids,anchors,check}` + 4 scripts + tests) is deleted.

**Tech stack:** TypeScript, Astro 6, React 19, vitest 2 + jsdom. Run pnpm from `commentary/`; run git from the repo root `/Users/yujiym/GitHub/ef-mandate-localize-jp` (the shell cwd is `commentary/`, so plain `commentary/...` git paths double — use `git -C <repo-root>` or repo-root-relative paths).

**Baseline:** `feat/commentary`, clean tree. `pnpm -r typecheck`/`test` green (60 core + 41 site + 9 widget = 110). Spec: `commentary/docs/specs/2026-06-14-retire-block-id-generic-anchoring-design.md`.

---

## File structure

| File | Change |
|---|---|
| `commentary/widget/src/display.ts` | `projectComments` → resolve per-comment via `resolveContainer` (findByQuote fallback), key `byBlock` by resolved `Element`; paint/focus/click use the element |
| `commentary/widget/test/display.test.ts` | add: stale/empty `rootSelector` still projects via quote |
| `commentary/site/src/lib/blocks.ts` | marker-free: `Block = { content }`, `parseChapter` splits only |
| `commentary/site/src/lib/content.ts` | positional alignment; `RenderedBlock` drops `blockId` (keeps `order`) |
| `commentary/site/src/components/Block.astro` | drop `data-block-id` (keep `.block` wrapper) |
| `commentary/site/scripts/gen-mock-comments.ts` | `rootSelector: ""` |
| `commentary/site/src/anno/mock-comments.json` | regenerate |
| `commentary/site/tests/{content,blocks,anchoring-integration}.test.ts` | rewrite (marker-free / positional / decoupled from `anchors.ts`) |
| **delete** | `site/src/lib/{inject,ids,anchors,check}.ts`; `site/scripts/{inject-markers,check-markers,build-anchors,reanchor-demo}.ts`; `site/tests/{inject,ids,anchors,check}.test.ts` |
| `commentary/site/package.json` | drop `blocks:inject`, `blocks:check`, `anchors:build`, `reanchor:demo` |
| **revert to main** | `source/**/*.md` (markers), `scripts/build.py` (strip) |
| `@commentary/core` | **unchanged** |

---

## Task 1: Widget read-path robustness (`display.ts`) — TDD

Make the read path resolve each comment via the core fallback so stale/empty selectors still anchor, and key projection by the resolved element (no re-`querySelector` of the stored selector).

**Files:**
- Modify: `commentary/widget/src/display.ts`
- Test: `commentary/widget/test/display.test.ts`

- [ ] **Step 1: Add the failing test** — append to `commentary/widget/test/display.test.ts`, inside `describe("projectComments", …)` (after the existing cases):

```ts
  it("anchors via findByQuote when rootSelector is empty/stale", () => {
    document.body.innerHTML = '<p data-block-id="t1">the walkaway test</p>';
    const byBlock = projectComments([stored({ rootSelector: "" })], "https://x/");
    const items = [...byBlock.values()].flat();
    expect(items).toHaveLength(1);
    expect(items[0].comment.uid).toBe("0x1");
    expect(items[0].projection.status).not.toBe("orphaned");
  });
```

- [ ] **Step 2: Run — expect FAIL.** `pnpm --filter @commentary/widget test`
  Expected: with `rootSelector: ""`, the current `document.querySelector("")` throws / drops the comment → assertion fails (or SyntaxError).

- [ ] **Step 3: Rewrite `projectComments` + the consumers in `display.ts`.**

Add `resolveContainer` to the core import:
```ts
import { resolveContainer } from "@commentary/core/anno/selector";
```

Replace the exported `projectComments` (it now keys by the resolved `Element`):
```ts
/**
 * Resolve each page-scoped comment to its live container (rootSelector → quote
 * fallback) and project its span. Keyed by the resolved Element so paint/focus/
 * hit-test never re-run a stale stored selector. Block-ID-free: works on any host.
 */
export function projectComments(
  stored: StoredAnno[],
  urlCanonical: string,
): Map<Element, LocatedAnno[]> {
  const groups = new Map<Element, StoredAnno[]>();
  for (const c of commentsForUrl(stored, urlCanonical)) {
    const el = resolveContainer(document, c.rootSelector, c.spanExact);
    if (!el) continue;
    const arr = groups.get(el);
    if (arr) arr.push(c);
    else groups.set(el, [c]);
  }
  const byBlock = new Map<Element, LocatedAnno[]>();
  for (const [el, group] of groups) byBlock.set(el, projectAnno(el, group));
  return byBlock;
}
```

In `createDisplay`, change the `byBlock` type and the three consumers to use the element key directly. Update the declaration:
```ts
  let byBlock = new Map<Element, LocatedAnno[]>();
```
`project()` stays `byBlock = projectComments(stored, canonicalizeUrl(location.href).urlCanonical);`.

Replace `paintHighlights` (iterate elements, no `querySelector`):
```ts
  function paintHighlights(): void {
    if (!visible) {
      applyHighlights("comment", []);
      applyHighlights("comment-focus", []);
      return;
    }
    const ranges: Range[] = [];
    for (const [blockEl, items] of byBlock) {
      for (const p of items) {
        const s = p.projection.status;
        if (s !== "anchored" && s !== "re-anchored") continue;
        if (p.projection.start === null || p.projection.end === null) continue;
        const r = rangeForOffsets(blockEl, p.projection.start, p.projection.end);
        if (r) ranges.push(r);
      }
    }
    applyHighlights("comment", ranges);
  }
```

Replace `onDocClick`'s loop body to use the element key:
```ts
    for (const [blockEl, group] of byBlock) {
      if (!blockEl.contains(pos.node)) continue;
      for (const p of group) {
        if (p.projection.start === null || p.projection.end === null) continue;
        const r = rangeForOffsets(blockEl, p.projection.start, p.projection.end);
        if (r && r.comparePoint(pos.node, pos.offset) === 0) {
          clickCb(p.comment.uid);
          return;
        }
      }
    }
```

Replace `focus(uid)`'s loop to use the element key (no `querySelector`):
```ts
    focus(uid: string | null) {
      if (!uid) {
        applyHighlights("comment-focus", []);
        return;
      }
      for (const [blockEl, group] of byBlock) {
        const located = group.find((p) => p.comment.uid === uid);
        if (!located) continue;
        if (located.projection.start === null || located.projection.end === null) return;
        const r = rangeForOffsets(blockEl, located.projection.start, located.projection.end);
        if (r) {
          applyHighlights("comment-focus", [r]);
          blockEl.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        return;
      }
    },
```

`dispose()` stays `byBlock = new Map();`. `count()`/`projected()` unchanged.

- [ ] **Step 4: Run — expect PASS.** `pnpm --filter @commentary/widget test` (display.test 3 + highlight 5 + thread 2 = 10).
- [ ] **Step 5: Typecheck.** `pnpm --filter @commentary/widget typecheck` → clean.
- [ ] **Step 6: Commit.**
```bash
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp add commentary/widget/src/display.ts commentary/widget/test/display.test.ts
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp commit -m "feat(widget): resolve comments by element with findByQuote fallback

display.projectComments resolves each comment via resolveContainer (selector →
quote) and keys byBlock by the resolved element, so stale/empty rootSelectors
still anchor. Enables block-ID-free hosts."
```

---

## Task 2: Delete the marker machinery

After this the site is still marker-based (source markers, `content.ts`/`blocks.ts` unchanged) — only the now-isolated id/marker tooling and its tests go. `content.ts`/`blocks.ts` don't import any of these, so deletion is clean.

**Files:** delete `site/src/lib/{inject,ids,anchors,check}.ts`, `site/scripts/{inject-markers,check-markers,build-anchors,reanchor-demo}.ts`, `site/tests/{inject,ids,anchors,check}.test.ts`; modify `site/package.json`, `site/tests/anchoring-integration.test.ts`.

- [ ] **Step 1: Confirm no live importers.** Run:
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/commentary && grep -rn "lib/inject\|lib/ids\|lib/anchors\|lib/check\|from \"./inject\"\|from \"./ids\"\|from \"./anchors\"\|from \"./check\"" site/src site/scripts site/tests | grep -v node_modules
```
Expected: matches only inside the files being deleted (inject.ts→ids, the 4 scripts, the 4 tests, anchoring-integration.test→anchors). No reference from `content.ts`/`blocks.ts`/`Block.astro`.

- [ ] **Step 2: Delete the modules, scripts, and tests.**
```bash
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp rm \
  commentary/site/src/lib/inject.ts commentary/site/src/lib/ids.ts \
  commentary/site/src/lib/anchors.ts commentary/site/src/lib/check.ts \
  commentary/site/scripts/inject-markers.ts commentary/site/scripts/check-markers.ts \
  commentary/site/scripts/build-anchors.ts commentary/site/scripts/reanchor-demo.ts \
  commentary/site/tests/inject.test.ts commentary/site/tests/ids.test.ts \
  commentary/site/tests/anchors.test.ts commentary/site/tests/check.test.ts
```

- [ ] **Step 3: Drop the 4 npm scripts** from `commentary/site/package.json`. Remove these lines:
```json
    "blocks:inject": "tsx scripts/inject-markers.ts",
    "blocks:check": "tsx scripts/check-markers.ts",
    "anchors:build": "tsx scripts/build-anchors.ts",
```
and
```json
    "reanchor:demo": "tsx scripts/reanchor-demo.ts"
```
(Keep `gen:mock` and `anno:schema:register`. Ensure the preceding line's trailing comma stays valid JSON — `gen:mock` becomes the last script entry; it had a trailing comma before `reanchor:demo`, so remove that comma.)

- [ ] **Step 4: Rewrite `anchoring-integration.test.ts`** (decouple from the deleted `anchors.ts`; it tests core `project()` statuses via a plain block, no markers). Replace the whole file:

```ts
import { describe, it, expect } from "vitest";
import { makeAnchor, project } from "@commentary/core/lib/anchoring";
import { normalizeBlockText } from "@commentary/core/lib/normalize";
import { blockHashFromNormalized } from "@commentary/core/lib/hash";

/** A live block's {text, blockHash} from plain paragraph text (no markers). */
function blockOf(text: string) {
  const norm = normalizeBlockText(text);
  return { text: norm, blockHash: blockHashFromNormalized(norm) };
}

const ORIGINAL = "Our ultimate goal is for Ethereum to pass the walkaway test.";

describe("anchoring integration", () => {
  const orig = blockOf(ORIGINAL);
  const quoteStart = [...orig.text.slice(0, orig.text.indexOf("walkaway"))].length;
  const anchor = makeAnchor(orig.blockHash, orig.text, quoteStart, quoteStart + "walkaway".length);

  it("anchored: the commented block is unchanged", () => {
    const p = project(anchor, blockOf(ORIGINAL));
    expect(p.status).toBe("anchored");
    expect(p.pastVersion).toBe(false);
  });

  it("re-anchored: the block changed but the quote survives", () => {
    const cur = blockOf("Ultimately, Ethereum must pass the walkaway test someday.");
    const p = project(anchor, cur);
    expect(p.status).toBe("re-anchored");
    expect(p.pastVersion).toBe(true);
    expect(cur.text.slice(p.start!, p.end!)).toBe("walkaway");
  });

  it("needs-review: the quoted word was rewritten", () => {
    const p = project(anchor, blockOf("Our ultimate goal is for Ethereum to pass the leave test."));
    expect(p.status).toBe("needs-review");
    expect(p.pastVersion).toBe(true);
  });

  it("orphaned: the commented block was removed", () => {
    const p = project(anchor, null);
    expect(p.status).toBe("orphaned");
    expect(p.pastVersion).toBe(true);
  });
});
```

- [ ] **Step 5: Typecheck + test.** `pnpm --filter @commentary/site typecheck` (clean) and `pnpm --filter @commentary/site test` (marker tests gone; `content`/`blocks` still pass — they're still marker-based here; `anchoring-integration` passes rewritten).
- [ ] **Step 6: Commit.**
```bash
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp add -A commentary/site
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp commit -m "chore(site): delete block-ID marker machinery

Remove lib/{inject,ids,anchors,check}, the inject/check/anchors/reanchor
scripts + npm scripts + their tests; rewrite anchoring-integration.test to
exercise core project() statuses without buildChapterAnchors. content.ts/
blocks.ts are still marker-based here (made marker-free next)."
```

---

## Task 3: Marker-free content pipeline + strip source

Atomic: make `blocks.ts`/`content.ts`/`Block.astro` block-ID-free, rewrite their tests, and revert `source/` + `build.py` to `main` — so the site builds with clean source and positional alignment.

**Files:** `site/src/lib/blocks.ts`, `site/src/lib/content.ts`, `site/src/components/Block.astro`, `site/tests/blocks.test.ts`, `site/tests/content.test.ts`; revert `source/**/*.md`, `scripts/build.py`.

- [ ] **Step 1: Rewrite `site/src/lib/blocks.ts`** (marker-free):
```ts
export interface Block {
  /** One blank-line-delimited segment of a chapter's Markdown. */
  content: string;
}

/** Parse a chapter's Markdown into blocks (blank-line delimited). */
export function parseChapter(source: string): Block[] {
  const lf = source.replace(/\r\n?/g, "\n");
  return lf
    .split(/\n[ \t]*\n+/)
    .map((s) => s.replace(/^\n+|\n+$/g, ""))
    .filter((s) => s.trim().length > 0)
    .map((content) => ({ content }));
}
```

- [ ] **Step 2: Rewrite the merge in `site/src/lib/content.ts`.** Change `RenderedBlock` (drop `blockId`):
```ts
export interface RenderedBlock {
  order: number;
  sourceHtml: string; // EN source, always present
  translations: Partial<Record<Lang, string>>; // aligned translations only
}
```
Replace `mergeChapter` with positional alignment (a translation is aligned iff its block count equals EN's):
```ts
/**
 * Merge an EN chapter with its translations by position. A translation is
 * "aligned" only when it has the same number of blocks as EN (block i ↔ EN
 * block i); otherwise it's omitted and the chapter falls back to EN ("pending").
 */
export function mergeChapter(
  number: string,
  enBlocks: Block[],
  translations: Map<Lang, Block[]>,
): Chapter {
  const aligned = new Map<Lang, Block[]>();
  for (const [lang, blocks] of translations) {
    if (blocks.length === enBlocks.length) aligned.set(lang, blocks);
  }

  const blocks: RenderedBlock[] = enBlocks.map((b, i) => {
    const blockTranslations: Partial<Record<Lang, string>> = {};
    for (const [lang, tBlocks] of aligned) blockTranslations[lang] = renderMarkdown(tBlocks[i].content);
    return { order: i, sourceHtml: renderMarkdown(b.content), translations: blockTranslations };
  });

  const chapterTranslations: Partial<Record<Lang, { title: string }>> = {};
  for (const [lang, tBlocks] of aligned) {
    chapterTranslations[lang] = { title: chapterTitle(tBlocks[0].content) };
  }

  return {
    number,
    sourceTitle: chapterTitle(enBlocks[0].content),
    translations: chapterTranslations,
    blocks,
  };
}
```
`chapterTitle`, `blockHtml`, `titleFor`, `isPending`, `isFallback`, and `loadChapters` are unchanged (none reference `blockId`).

- [ ] **Step 3: Drop `data-block-id` in `site/src/components/Block.astro`.** Change line 13:
```astro
<div class="block relative">
```
(Everything else in the file stays; the inner `prose` div + `set:html` are unchanged.)

- [ ] **Step 4: Rewrite `site/tests/blocks.test.ts`** (marker-free):
```ts
import { describe, it, expect } from "vitest";
import { parseChapter } from "../src/lib/blocks";

describe("parseChapter", () => {
  it("splits on blank lines into blocks", () => {
    const blocks = parseChapter("# Heading\n\nFirst para.\n\nSecond para.");
    expect(blocks.map((b) => b.content)).toEqual(["# Heading", "First para.", "Second para."]);
  });
  it("keeps a single internal newline inside one block", () => {
    const blocks = parseChapter("line one\nline two\n\nnext");
    expect(blocks[0].content).toBe("line one\nline two");
    expect(blocks).toHaveLength(2);
  });
  it("ignores blank-only lines between blocks (incl. CRLF)", () => {
    expect(parseChapter("a\r\n\r\nb").map((b) => b.content)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 5: Rewrite `site/tests/content.test.ts`** (positional; no markers, no unmarked-throw):
```ts
import { describe, it, expect } from "vitest";
import { parseChapter, type Block } from "../src/lib/blocks";
import { renderMarkdown } from "../src/lib/render";
import { mergeChapter, blockHtml, titleFor, isPending, isFallback } from "../src/lib/content";
import type { Lang } from "../src/lib/i18n";

const en = parseChapter("# Chapter One\n\nEnglish body."); // 2 blocks
const jaAligned = parseChapter("# 第一章\n\n日本語の本文。"); // 2 blocks
const jaMisaligned = parseChapter("# 第一章のみ"); // 1 block ≠ 2

describe("mergeChapter", () => {
  it("stores a translation when block counts match", () => {
    const ch = mergeChapter("01", en, new Map<Lang, Block[]>([["ja", jaAligned]]));
    expect(ch.sourceTitle).toBe("Chapter One");
    expect(ch.translations.ja?.title).toBe("第一章");
    expect(isPending(ch, "ja")).toBe(false);
    expect(ch.blocks[1].translations.ja).toBe(renderMarkdown("日本語の本文。"));
    expect(blockHtml(ch.blocks[1], "ja")).toBe(renderMarkdown("日本語の本文。"));
    expect(isFallback(ch.blocks[1], "ja")).toBe(false);
  });

  it("falls back to EN when block counts differ (pending)", () => {
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
});
```

- [ ] **Step 6: Verify the source diff is markers-only, then revert source + build.py to main.**
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
# Only marker lines should differ (ignore +++/--- headers); expect NO output:
git diff main..HEAD -- source | grep -E '^[+-]' | grep -vE '^[+-]{3} ' | grep -v 'block:'
```
Expected: **empty**. If empty, revert:
```bash
git checkout main -- source scripts/build.py
```
(If non-empty, there is prose drift — instead strip only marker lines per file with `perl -ni -e 'print unless /^\s*<!--\s*block:.*-->\s*$/' <file>` and hand-revert `scripts/build.py`'s `BLOCK_MARKER_RE` block.)

- [ ] **Step 7: Typecheck + test + build.**
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/commentary
pnpm --filter @commentary/site typecheck   # clean
pnpm --filter @commentary/site test        # blocks/content rewritten; all pass
pnpm --filter @commentary/site build       # builds 2 pages; no "unmarked"/throw
```

- [ ] **Step 8: Commit.**
```bash
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp add -A commentary/site source scripts/build.py
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp commit -m "feat(site): marker-free content pipeline; positional alignment

blocks.ts parses by blank lines only; content.ts aligns EN↔translation by
position; Block.astro drops data-block-id. Source markers + build.py strip
revert to main. Comments anchor via generated selectors + hash + quote."
```

---

## Task 4: Mock fixture uses quote anchoring

`gen-mock` can't know a positional selector (Node, no DOM), so it emits `rootSelector: ""`; Task 1's `findByQuote` fallback resolves it.

**Files:** `site/scripts/gen-mock-comments.ts`, `site/src/anno/mock-comments.json` (regenerated).

- [ ] **Step 1:** In `commentary/site/scripts/gen-mock-comments.ts`, change the `fields()` return (the `rootSelector` line):
```ts
    rootSelector: "",
```
(The `blockId` arg + `BLOCKS` text lookup stay — they supply the quote text/hash. Only the selector becomes empty.)

- [ ] **Step 2: Regenerate the fixture.** `pnpm --filter @commentary/site run gen:mock`
  Expected: `wrote 10 mock attestations → …/src/anno/mock-comments.json`.

- [ ] **Step 3: Typecheck + test.** `pnpm --filter @commentary/site typecheck` / `test` → green.

- [ ] **Step 4: Commit.**
```bash
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp add commentary/site/scripts/gen-mock-comments.ts commentary/site/src/anno/mock-comments.json
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp commit -m "chore(site): mock comments anchor by quote (rootSelector empty)

gen-mock can't know a positional selector; emit rootSelector:\"\" and rely on
the display findByQuote fallback (Task 1)."
```

---

## Task 5: Verify self-containment + finish

**Files:** none (verification + integration).

- [ ] **Step 1: The diff vs main is `commentary/`-only.**
```bash
git -C /Users/yujiym/GitHub/ef-mandate-localize-jp diff --stat main..HEAD -- ':!commentary'
```
Expected: **empty** (no `source/`, `scripts/`, root `.gitignore`, `GLOSSARY.md`… wait: `GLOSSARY.md` is a translation edit kept on purpose). If `GLOSSARY.md` is the *only* line, that's expected (translation glossary, not commentary). Anything else outside `commentary/` must be investigated.

- [ ] **Step 2: Full gates.**
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/commentary
pnpm -r typecheck                       # 3 packages clean
pnpm -r test                            # core 60 + site (≈39 after marker-test removal) + widget 10
pnpm --filter @commentary/site build    # 2 pages, no warnings
```

- [ ] **Step 3: Browser (mock).** `pnpm --filter @commentary/site run dev:mock`; hard-refresh `http://localhost:4321/` and `/ja`. Verify: no `data-block-id` in the DOM (DevTools); the `💬` button opens the panel + paints amber underlines; comments anchor to paragraphs; select→compose still works; card/span focus-jump works. Comments scope per URL.

- [ ] **Step 4: Address findings** (if any) via the relevant file; rebuild; re-verify; commit.

- [ ] **Step 5: Finish.** Announce + use **superpowers:finishing-a-development-branch**. (`feat/commentary` is the working branch; the natural next step is its own merge to `main` whenever the maintainer is ready — note the ANNO schema is still unregistered, blocking live commenting.)

---

## Self-review

**Spec coverage:** core unchanged ✓ (Task list touches no core file). `Block.astro` drop data-block-id → T3. `content.ts` positional → T3. `display.ts` resolveContainer/findByQuote → T1. `gen-mock` `""` → T4. Remove markers + build.py + lib + scripts + tests → T2/T3. `main` diff = commentary-only → T5. Schema unchanged → no task touches the schema (correct). ✓

**Placeholder scan:** every code step has full code; deletes/reverts are exact commands; the one conditional (source markers-only verify) has both branches. ✓

**Type consistency:** `Block = { content }` (T3) matches `parseChapter` return + `content.ts`/tests usage. `RenderedBlock` drops `blockId`, keeps `order`/`sourceHtml`/`translations` — matches `Block.astro` (no longer reads `blockId`) + `blockHtml`/`isFallback`. `projectComments(): Map<Element, LocatedAnno[]>` (T1) is consistent across `paintHighlights`/`focus`/`onDocClick`/`projected`/`dispose` + the test's `[...byBlock.values()].flat()`. `resolveContainer(document, rootSelector, spanExact)` matches `core/anno/selector.ts`. ✓
