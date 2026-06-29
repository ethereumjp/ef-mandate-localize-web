# Retire block-ID — translation site dogfoods the generic anchoring — Design

**Date:** 2026-06-14
**Status:** Approved (design), pending implementation plan
**Branch context:** `feat/commentary` (after the widget UI redesign merge).

## Goal

Stop injecting `<!-- block: … -->` markers / `data-block-id` for comment anchoring. The translation site renders natural HTML and the widget anchors it the **same way it anchors any third-party site** — generated CSS `rootSelector` + `containerHash` + TextQuote (`spanExact`/`spanPrefix`/`spanSuffix`). Net effect: `feat/commentary` differs from `main` **only within `commentary/`** (the `source/`, `scripts/build.py`, and root `.gitignore` changes the commentary work introduced are all reverted), and the comment system has one anchoring path for all hosts.

## Background — current state

- **Anchoring core is already generic** (`@commentary/core/anno/selector.ts`): `nearestContainer` prefers `[data-block-id]` but **falls back to any `id` or block-level tag** (`P`, `LI`, `BLOCKQUOTE`, `H1`–`H6`, `ARTICLE`, `SECTION`, …); `selectorFor` prefers `[data-block-id]`/`id` then emits an `:nth-of-type` path; `resolveContainer(doc, rootSelector, exact)` tries `rootSelector` then `findByQuote(doc, exact)` (smallest block-level element whose normalized text contains the quote). **No core change is needed.**
- **Block-ID lives entirely in the site:**
  - `Block.astro` renders `<div class="block relative" data-block-id={block.blockId}>`.
  - `lib/content.ts` aligns EN↔translation **by id** and emits `RenderedBlock.blockId`.
  - `lib/blocks.ts` (`MARKER_RE`, `parseChapter`), `lib/inject.ts` (assign/serialize ids), `lib/ids.ts` (`formatId`/`nextIdNumber`), `lib/anchors.ts` (blockId→hash index).
  - `source/**/*.md` carry `<!-- block: NN-pM -->` markers (committed); `scripts/build.py` strips them for the PDF build.
  - Scripts `blocks:inject` (`inject-markers.ts`), `blocks:check` (`check-markers.ts`), `anchors:build` (`build-anchors.ts`), `reanchor:demo` (`reanchor-demo.ts`) + tests.
  - `gen-mock-comments.ts` hardcodes `rootSelector: \`[data-block-id="${blockId}"]\``.
- **`display.ts` read path** groups page comments by `rootSelector` and resolves each with raw `document.querySelector(rootSelector)`, skipping misses — it does **not** use `resolveContainer`/`findByQuote`, so a stale/empty selector drops the comment.

## Locked decision

**Approach A — pure generic.** The site renders natural HTML (no `data-block-id`); comments anchor via positional `rootSelector` + `containerHash` + TextQuote. (Rejected **Approach B**, build-time `id="b-{hash}"`: it reintroduces a block-ID under another name and gives no help against text edits, only reordering — marginal benefit.)

**Schema unchanged.** `ANNO_SCHEMA` has **no `blockId` field** — block-ID was only the *value* of `rootSelector` (`[data-block-id="…"]`) on this site. After the change `rootSelector` simply holds a positional selector (or any host `id`); the field **stays** — it's the fast, exact primary locator (`querySelector`), with `findByQuote` (O(elements)) as the fallback, and on an immutable schema there's no reason to drop a useful-when-valid field. All 14 fields (`url, urlCanonical, origin, lang, rootSelector, containerHash, spanStart, spanEnd, spanExact, spanPrefix, spanSuffix, parentUid, body, meta`) remain in use — verified nothing is now redundant. The schema is still unregistered, so this was the moment to reconsider; conclusion: register as-is.

## Component design

### 1. Anchor granularity — `Block.astro`

Drop `data-block-id`; keep `<div class="block relative">` (layout: `.block { scroll-margin-top }`). With no marker, `nearestContainer` returns the inner block-level element (the `<p>`/`<h1>` produced by `set:html`), so a comment anchors to the **real paragraph**, exactly as on a third-party site. `containerHash` (normalized text of that `<p>`) equals the old block text, so existing mock comments still hash-match.

### 2. EN↔translation alignment — `lib/content.ts`

Alignment becomes **positional** instead of id-based:
- `loadChapters` parses each chapter into blocks (blank-line split; no markers).
- A translation is **aligned** iff its block count equals EN's (block `i` ↔ EN block `i`); otherwise the chapter is **pending** for that language (falls back to EN) — same observable behavior as today's id-mismatch→pending.
- `RenderedBlock` drops `blockId`; keep `order` (already present). `Block.astro` no longer needs an id prop.
- `mergeChapter`/`parseChapter` lose their id/marker handling.

### 3. Read-path robustness — `widget/src/display.ts`

`projectComments` must tolerate stale/empty selectors (positional selectors drift; the mock uses `""`). Resolve **per comment** via the core fallback:
- For each page-scoped comment, `container = resolveContainer(document, c.rootSelector, c.spanExact)` (rootSelector → `findByQuote(spanExact)`).
- Group comments by the resolved `Element`, `projectAnno(el, group)` per element, and key the resulting `byBlock` map by a **freshly generated `selectorFor(el)`** so `focus()` and the click hit-test keep a valid current selector. Comments that resolve to nothing are dropped (as today).

This is the one behavioral change beyond removal, and it makes the read path correct for *any* host, not just this site.

### 4. Mock fixture — `scripts/gen-mock-comments.ts` + `src/anno/mock-comments.json`

`gen-mock` can't know the rendered positional selector (it runs in Node, no DOM), so it emits **`rootSelector: ""`** and relies on `findByQuote(spanExact)` (§3) to anchor. Regenerate `mock-comments.json` after the change. Existing hardcoded `[data-block-id=…]` selectors would otherwise be stale.

### 5. Removals

- **Source/build:** strip markers from `source/**/*.md` and revert `scripts/build.py` — both back to `main` (verify the only diff vs `main` was the markers / the strip-regex; restore via `git checkout main -- <path>` after confirming no prose drift).
- **Site lib:** delete `lib/inject.ts`, `lib/anchors.ts`, `lib/ids.ts`; reduce `lib/blocks.ts` to a marker-free `parseChapter` (blank-line split) — or fold it into `content.ts` if that leaves it trivial.
- **Scripts + npm scripts:** remove `inject-markers.ts`/`blocks:inject`, `check-markers.ts`/`blocks:check`, `build-anchors.ts`/`anchors:build`, `reanchor-demo.ts`/`reanchor:demo`.
- **Tests:** delete `inject`/`check`/`ids`/`anchors` tests; rewrite `content.test`/`blocks.test` for positional alignment + marker-free parsing. Keep `render`/`anchoring-integration`/`highlight`/etc.
- **core:** no change. (`selector.ts` keeps the harmless `[data-block-id]` preference for hosts that *do* have ids; `normalize.ts`'s `MARKER_LINE_RE` may stay as a defensive no-op or be removed — implementer's call.)

## Data flow (after)

- **Author:** select text → `nearestContainer` (inner `<p>`) → `selectorFor` (positional) + `containerHash` + TextQuote → `AnnoFields` → attest.
- **Read:** `display.refresh` → `projectComments` resolves each comment via `resolveContainer` (selector → quote) → `projectAnno` → highlights + list.

## Edge cases

- **Paragraph reorder/insert:** positional selector goes stale → `findByQuote(spanExact)` recovers (text unchanged). Stored selector is stale but harmless.
- **Text edit of a commented span:** anchoring degrades to TextQuote fuzzy match and may orphan — unavoidable for mutable content; block-ID never helped here either.
- **Duplicate text:** `findByQuote` returns the *smallest* matching block; `spanPrefix`/`spanSuffix` disambiguate within it (existing behavior).
- **Empty `rootSelector` (mock):** `resolveContainer` skips the selector → `findByQuote`. (`querySelector("")` must never be called — §3 routes through `resolveContainer`.)

## Migration

The ANNO schema is **not yet registered**, so there are no live comments — only the dev mock fixture, which is regenerated (§4). No on-chain migration needed.

## Out of scope

- Registering the ANNO schema. The deferred Stage-3 lazy-eas-sdk split. Any widget UI change. `findByQuote` perf (O(elements) scan) — acceptable at translation-page size; optimize later if needed.

## Files affected

`commentary/site/src/components/Block.astro` · `site/src/lib/content.ts` · `site/src/lib/blocks.ts` (reduce) · **delete** `site/src/lib/{inject,anchors,ids}.ts` · `site/scripts/gen-mock-comments.ts` · `site/src/anno/mock-comments.json` (regenerate) · **delete** `site/scripts/{inject-markers,check-markers,build-anchors,reanchor-demo}.ts` · `site/package.json` (drop 4 scripts) · `site/tests/*` (delete marker tests, rewrite content/blocks) · `commentary/widget/src/display.ts` (resolveContainer fallback) · **revert to main**: `source/**/*.md`, `scripts/build.py`.

## Testing

- **Unit (site, vitest/jsdom):** `content.test` — positional alignment (count match → aligned; mismatch → pending; EN authority). `blocks.test` — marker-free `parseChapter` (blank-line split).
- **Unit (widget):** extend `display.test` — a comment with a stale/empty `rootSelector` still projects via `findByQuote`; a valid selector still projects directly.
- **Build gates:** `pnpm -r typecheck`/`test` green; `pnpm --filter @commentary/site build` (2 pages); `git diff --stat main..HEAD -- ':!commentary'` is **empty**.
- **Browser (mock):** `dev:mock` → highlights + panel still work with no `data-block-id` in the DOM; select→compose→(mock) still anchors.
