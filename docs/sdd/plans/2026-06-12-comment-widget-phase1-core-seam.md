# Comment Widget — Phase 1: Core seam (anchor-dom + generic authoring) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple comment authoring from the host site's block model — promote the DOM-anchoring helpers to a neutral `lib/anchor-dom`, teach the selector to treat `[data-block-id]` as a preferred stable container, and switch `CommentController` to the generic `buildAnnoFields` — all behavior-preserving for the translation site.

**Architecture:** Pure refactor + one selector enhancement, done in-place in the current single `site/` package (the monorepo split is a later phase). This proves the `core` seam from the spec: after this phase, `anno/*` no longer reaches into `web3/`, and authoring works on arbitrary DOM while still producing `[data-block-id="…"]` selectors for the site.

**Tech Stack:** TypeScript (ESM), vitest 2 + jsdom, Astro 6 / React 19. All commands run from `site/`.

**Spec:** `site/docs/specs/2026-06-12-embeddable-comment-widget-design.md` (§4 module boundaries, §7 authoring, §15 Phase 1).

---

## Preconditions

- Branch `feat/commentary` (commit here; do not touch main). Run all commands from `site/`.
- Baseline: `npm test` = 106 passing (26 files), `npm run check:astro` = 0 errors. Confirm before starting.
- This phase does **not** introduce Shadow DOM, the floating button, the on/off toggle ownership, the embed build, or the monorepo split — those are later phases.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/lib/anchor-dom.ts` | Create (moved from `web3/selection.ts`) | DOM-anchoring helpers: `normalizedBlockText`, `selectionToOffsets`, `anchorFromSelection`, `SelectionOffsets` |
| `src/web3/selection.ts` | Delete | (contents move to `lib/anchor-dom.ts`) |
| `src/anno/{author,selector,locate}.ts` | Modify imports | repoint `web3/selection` → `lib/anchor-dom` |
| `src/anno/selector.ts` | Modify logic | `nearestContainer`/`selectorFor` prefer `[data-block-id]` |
| `src/components/comments/CommentApp.tsx` | Modify | use `nearestContainer` + `buildAnnoFields` for authoring |
| `tests/anchor-dom.test.ts` | Create (renamed from `tests/selection.test.ts`) | tests for the moved helpers |
| `tests/{projectComments,anno.locate}.test.ts` | Modify imports | repoint to `lib/anchor-dom` |
| `tests/selector.test.ts` | Create | tests for the selector enhancement |
| `tests/anno.author.test.ts` | Create | behavior-preservation of `buildAnnoFields` on a site-like block |

---

## Task 1: Promote `lib/anchor-dom` (move out of `web3/`)

Pure move — no behavior change. The existing suite is the safety net.

**Files:**
- Create: `src/lib/anchor-dom.ts`
- Delete: `src/web3/selection.ts`
- Modify: `src/anno/author.ts`, `src/anno/selector.ts`, `src/anno/locate.ts`, `src/components/comments/CommentApp.tsx`, `tests/projectComments.test.ts`, `tests/anno.locate.test.ts`
- Rename: `tests/selection.test.ts` → `tests/anchor-dom.test.ts`

- [ ] **Step 1: Create `src/lib/anchor-dom.ts`** with the exact contents of the current `web3/selection.ts`, with the three relative imports rebased from `../lib/*` to `./*`:

```ts
import { normalizeBlockText, codePointLength } from "./normalize";
import { blockHash } from "./hash";
import { makeAnchor, type Anchor } from "./anchoring";

/** The normalized, rendered text of a block element (what the reader selects over). */
export function normalizedBlockText(blockEl: Element): string {
  return normalizeBlockText(blockEl.textContent ?? "");
}

export interface SelectionOffsets {
  start: number;
  end: number;
  exact: string;
}

/**
 * Map a DOM Range to code-point [start,end) offsets in the block's normalized text.
 * Returns null for collapsed ranges or ranges not fully inside the block.
 */
export function selectionToOffsets(blockEl: Element, range: Range): SelectionOffsets | null {
  if (range.collapsed) return null;
  if (!blockEl.contains(range.startContainer) || !blockEl.contains(range.endContainer)) {
    return null;
  }

  const before = range.cloneRange();
  before.selectNodeContents(blockEl);
  before.setEnd(range.startContainer, range.startOffset);
  const rawPrefix = before.toString();

  const rawBlock = blockEl.textContent ?? "";
  const normalizedBlock = normalizeBlockText(rawBlock);
  const rawCps = [...rawBlock];
  const normCps = [...normalizedBlock];
  let leadTrim = 0;
  while (leadTrim < rawCps.length && rawCps[leadTrim] !== normCps[0]) {
    leadTrim++;
  }

  const prefixCps = codePointLength(rawPrefix) - leadTrim;
  const start = Math.max(0, prefixCps);

  const exact = normalizeBlockText(range.toString());
  if (exact.length === 0) return null;
  const end = start + codePointLength(exact);
  return { start, end, exact };
}

/** Build a full M3 anchor for a selection within a block. */
export function anchorFromSelection(blockEl: Element, range: Range): Anchor | null {
  const offsets = selectionToOffsets(blockEl, range);
  if (offsets === null) return null;
  const text = normalizedBlockText(blockEl);
  return makeAnchor(blockHash(text), text, offsets.start, offsets.end);
}
```

- [ ] **Step 2: Delete `src/web3/selection.ts`.**

```bash
git rm src/web3/selection.ts
```

- [ ] **Step 3: Repoint the four source importers.** Apply these exact edits:
  - `src/anno/author.ts:1` — `import { anchorFromSelection } from "../web3/selection";` → `import { anchorFromSelection } from "../lib/anchor-dom";`
  - `src/anno/selector.ts:2` — `import { normalizedBlockText } from "../web3/selection";` → `import { normalizedBlockText } from "../lib/anchor-dom";`
  - `src/anno/locate.ts:3` — `import { normalizedBlockText } from "../web3/selection";` → `import { normalizedBlockText } from "../lib/anchor-dom";`
  - `src/components/comments/CommentApp.tsx:8` — `import { anchorFromSelection } from "../../web3/selection";` → `import { anchorFromSelection } from "../../lib/anchor-dom";`

- [ ] **Step 4: Rename the test and repoint test importers.**

```bash
git mv tests/selection.test.ts tests/anchor-dom.test.ts
```
Then edit the import in `tests/anchor-dom.test.ts:3` — `from "../src/web3/selection"` → `from "../src/lib/anchor-dom"`. And repoint:
  - `tests/projectComments.test.ts:4` — `from "../src/web3/selection"` → `from "../src/lib/anchor-dom"`
  - `tests/anno.locate.test.ts:4` — `from "../src/web3/selection"` → `from "../src/lib/anchor-dom"`

- [ ] **Step 5: Verify nothing still references the old path, and the suite stays green.**

```bash
grep -rn "web3/selection" src scripts tests   # expect: no output
npm test
npm run check:astro
```
Expected: grep prints nothing; `npm test` = 106 passing; `check:astro` = 0 errors. (Pure move → behavior unchanged.)

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "refactor(site): promote DOM-anchoring helpers web3/selection -> lib/anchor-dom"
```

---

## Task 2: Selector prefers `[data-block-id]` stable containers

TDD. Makes `nearestContainer`/`selectorFor` return the marked block container for the site (so authoring round-trips), while leaving generic DOM behavior unchanged.

**Files:**
- Create: `tests/selector.test.ts`
- Modify: `src/anno/selector.ts`

- [ ] **Step 1: Write the failing tests.** Create `tests/selector.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { nearestContainer, selectorFor } from "../src/anno/selector";

function setBody(html: string): void {
  document.body.innerHTML = html;
}

describe("nearestContainer", () => {
  it("prefers a [data-block-id] ancestor over a closer block-level element", () => {
    setBody(`<div data-block-id="01-p"><div class="prose"><p>hello world</p></div></div>`);
    const p = document.querySelector("p")!;
    const c = nearestContainer(p.firstChild!);
    expect(c?.getAttribute("data-block-id")).toBe("01-p");
  });

  it("falls back to the nearest block-level element when no [data-block-id]/id ancestor", () => {
    setBody(`<section><p>hello world</p></section>`);
    const p = document.querySelector("p")!;
    expect(nearestContainer(p.firstChild!)).toBe(p);
  });
});

describe("selectorFor", () => {
  it("emits a [data-block-id] selector for a marked container", () => {
    setBody(`<div data-block-id="02-h"><p>x</p></div>`);
    const el = document.querySelector("[data-block-id]")!;
    expect(selectorFor(el)).toBe(`[data-block-id="02-h"]`);
  });

  it("emits an [id] selector for an id-bearing element", () => {
    setBody(`<div id="foo"><p>x</p></div>`);
    expect(selectorFor(document.getElementById("foo")!)).toBe(`[id="foo"]`);
  });

  it("walks up with :nth-of-type for unmarked elements", () => {
    setBody(`<section><p>a</p><p>b</p></section>`);
    const second = document.querySelectorAll("p")[1] as Element;
    expect(selectorFor(second)).toBe("body > section:nth-of-type(1) > p:nth-of-type(2)");
  });

  it("stops at the nearest [data-block-id] ancestor when walking up", () => {
    setBody(`<div data-block-id="03"><span><b>x</b></span></div>`);
    const b = document.querySelector("b")!;
    expect(selectorFor(b)).toBe(`[data-block-id="03"] > span:nth-of-type(1) > b:nth-of-type(1)`);
  });
});
```

- [ ] **Step 2: Run, verify it fails.**

```bash
npm test -- selector
```
Expected: FAIL — the `[data-block-id]` cases fail (current code returns the inner `<p>` / `:nth-of-type` selectors).

- [ ] **Step 3: Implement the enhancement in `src/anno/selector.ts`.** Replace `nearestContainer` (currently lines 41-48) and `selectorFor` (currently lines 54-66), and add a `blockIdSelector` helper just above `selectorFor`:

```ts
/** Nearest [data-block-id]/id-bearing or block-level ancestor (or the node itself). */
export function nearestContainer(node: Node): Element | null {
  let el: Element | null = node.nodeType === 1 ? (node as Element) : node.parentElement;
  let blockLevel: Element | null = null;
  for (; el; el = el.parentElement) {
    if (el.hasAttribute("data-block-id")) return el; // preferred: stable marker
    if (blockLevel === null && (el.id || BLOCK_TAGS.has(el.tagName))) blockLevel = el;
  }
  return blockLevel;
}

/** `[data-block-id="…"]` selector for a marked element, else null. */
function blockIdSelector(el: Element): string | null {
  const v = el.getAttribute("data-block-id");
  return v ? `[data-block-id="${v.replace(/(["\\])/g, "\\$1")}"]` : null;
}

/**
 * A CSS selector that re-selects `el`. Prefers a `[data-block-id]` marker, then an
 * id; otherwise walks up to <body> with :nth-of-type, stopping at the nearest
 * marker/id ancestor.
 */
export function selectorFor(el: Element): string {
  const ownBid = blockIdSelector(el);
  if (ownBid) return ownBid;
  if (el.id) return idSelector(el.id);
  const parts: string[] = [];
  for (let cur: Element | null = el; cur && cur.tagName !== "BODY"; cur = cur.parentElement) {
    const bid = blockIdSelector(cur);
    if (bid) {
      parts.unshift(bid);
      return parts.join(" > ");
    }
    if (cur.id) {
      parts.unshift(idSelector(cur.id));
      return parts.join(" > ");
    }
    parts.unshift(`${cur.tagName.toLowerCase()}:nth-of-type(${nthOfType(cur)})`);
  }
  parts.unshift("body");
  return parts.join(" > ");
}
```

- [ ] **Step 4: Run, verify it passes.**

```bash
npm test -- selector
npm test
```
Expected: `selector` tests PASS; full suite still 106+ passing (generic behavior unchanged).

- [ ] **Step 5: Commit.**

```bash
git add src/anno/selector.ts tests/selector.test.ts
git commit -m "feat(site): selectorFor/nearestContainer prefer [data-block-id] stable containers"
```

---

## Task 3: Switch `CommentController` authoring to `buildAnnoFields`

Wires the generic author path into the island. A unit test locks the behavior-preservation (Task 2 made it true); the island wiring itself is verified by typecheck + build + the mock flow.

**Files:**
- Create: `tests/anno.author.test.ts`
- Modify: `src/components/comments/CommentApp.tsx`

- [ ] **Step 1: Write the behavior-preservation test.** Create `tests/anno.author.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { buildAnnoFields } from "../src/anno/author";
import { anchorFromSelection } from "../src/lib/anchor-dom";

function rangeOver(textNode: Node, start: number, end: number): Range {
  const r = document.createRange();
  r.setStart(textNode, start);
  r.setEnd(textNode, end);
  return r;
}

describe("buildAnnoFields on a site-like block", () => {
  it("produces a [data-block-id] rootSelector and matches the legacy block anchor", () => {
    document.body.innerHTML = `<div data-block-id="01-p"><div class="prose"><p>the walkaway test</p></div></div>`;
    const blockDiv = document.querySelector("[data-block-id]")!;
    const text = document.querySelector("p")!.firstChild!;
    const range = rangeOver(text, 4, 12); // "walkaway"

    const fields = buildAnnoFields({ href: "https://x.test/p", lang: "en", range, body: "hi" });
    expect(fields).not.toBeNull();
    expect(fields!.rootSelector).toBe(`[data-block-id="01-p"]`);
    expect(fields!.spanExact).toBe("walkaway");
    expect(fields!.body).toBe("hi");

    // Same container + offsets as the legacy block-div anchor (behavior-preserving).
    const legacy = anchorFromSelection(blockDiv, range)!;
    expect(fields!.containerHash).toBe(legacy.blockHash);
    expect(fields!.spanStart).toBe(legacy.start);
    expect(fields!.spanEnd).toBe(legacy.end);
  });
});
```

- [ ] **Step 2: Run it.**

```bash
npm test -- anno.author
```
Expected: PASS (Task 2 made `nearestContainer` resolve the `[data-block-id]` div, so `buildAnnoFields` anchors over the same container as the legacy path). If it FAILS, Task 2 is incomplete — stop and fix Task 2 before changing the island.

- [ ] **Step 3: Rewrite the authoring wiring in `CommentApp.tsx`.**

  (3a) Imports — remove the now-unused `anchorFromSelection`, add the generic helpers. Change line 8 area to:
```tsx
import { encodeAnno, type AnnoFields } from "../../anno/schema";
import { buildAnnoFields } from "../../anno/author";
import { nearestContainer } from "../../anno/selector";
```
  (the `import { anchorFromSelection } from "../../lib/anchor-dom";` line from Task 1 is removed).

  (3b) Replace the `SelectionTarget` interface (currently lines 41-46) with a range-based target:
```tsx
interface SelectionTarget {
  container: Element;
  range: Range; // a cloned range, stable after the live selection clears
  rect: DOMRect;
}
```

  (3c) Replace the `selectionchange` handler body (currently lines 153-194) so it resolves the container via `nearestContainer` and stores a cloned range:
```tsx
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = nearestContainer(range.commonAncestorContainer);
      if (!container) {
        setSelection(null);
        return;
      }
      const rawRect = range.getBoundingClientRect();
      const rect = new DOMRect(
        rawRect.left,
        Math.max(8, rawRect.top - 36),
        rawRect.width,
        rawRect.height,
      );
      setSelection({ container, range: range.cloneRange(), rect });
    }
```

  (3d) Replace `annoFieldsFromTarget` (currently lines 287-305) with a `buildAnnoFields` call that returns the full fields (incl. body):
```tsx
  // Build the anno fields for the captured selection via the generic author path.
  function annoFieldsFromTarget(target: SelectionTarget, body: string): AnnoFields | null {
    return buildAnnoFields({ href: location.href, lang, range: target.range, body });
  }
```

  (3e) Update `openComposer` (currently lines 307-312) to build the preview fields (body empty) and stash them as `Omit<AnnoFields, "body">`:
```tsx
  function openComposer() {
    capturedTarget.current = selection;
    setComposerError(null);
    const preview = selection ? annoFieldsFromTarget(selection, "") : null;
    setComposerFields(preview); // body is "" in the preview; Composer ignores it
    setComposerOpen(true);
  }
```

  (3f) Update `handleSubmit` (currently around lines 314-323) so the fields come from `buildAnnoFields` with the real body:
```tsx
  async function handleSubmit(body: string) {
    const target = capturedTarget.current;
    if (!target) return;

    if (!signer || !ANNO_SCHEMA_UID) {
      setComposerError("Connect a wallet on Sepolia (and set PUBLIC_EAS_ANNO_SCHEMA_UID).");
      return;
    }

    const fields = annoFieldsFromTarget(target, body);
    if (!fields) {
      setComposerError("Could not anchor the selection. Try selecting within a single block.");
      return;
    }
    // …the rest of handleSubmit is unchanged (optimistic insert, attestComment, refetch)…
```
  Leave the remainder of `handleSubmit` (optimistic comment creation, `attestComment(signer, ANNO_SCHEMA_UID, encodeAnno(fields))`, refetch, error handling) exactly as-is. Note `composerFields` may need its type widened to `AnnoFields | null` if it was `Omit<AnnoFields, "body"> | null` — set it to `useState<AnnoFields | null>(null)` and pass `fieldsPreview={composerFields}` (the `Composer` reads only the non-body fields).

- [ ] **Step 4: Verify types, build, and the mock flow.**

```bash
npm test -- anno.author selector
npm run check:astro
npm run build
```
Expected: tests pass; `check:astro` 0 errors; `build` succeeds (2 pages).

- [ ] **Step 5: Manual behavior check (mock mode).** Run `npm run dev:mock`, open `/`, select text inside a chapter block, click the comment popover, and confirm the composer's field preview shows `rootSelector: [data-block-id="…"]` (same as before this change). Selecting across block boundaries should show the "Could not anchor" message rather than crashing.

- [ ] **Step 6: Commit.**

```bash
git add src/components/comments/CommentApp.tsx tests/anno.author.test.ts
git commit -m "feat(site): author comments via generic buildAnnoFields (drop data-block-id walk)"
```

---

## Self-Review

- **Spec coverage:** §4 "the `lib/anchor-dom` promotion creates the `core` seam" → Task 1. §7 "authoring generalization: `nearestContainer` + `buildAnnoFields`, drop `[data-block-id]` walk" → Tasks 2–3. The §7 items "remove `#wallet-slot` portal and `data-comments` coupling → own button/toggle" are **deliberately deferred** to the embed phase (they change UX/packaging), as agreed in the Phase 1 refinement — noted here so the next plan picks them up.
- **Behavior preservation:** the legacy site path used the `[data-block-id]` div as the container; Task 2 makes `nearestContainer` resolve the same div, and Task 3's test asserts identical `containerHash`/offsets and a `[data-block-id="…"]` `rootSelector`. Generic DOM (no marker) is unchanged (Task 2 `:nth-of-type` test).
- **Type consistency:** `nearestContainer(node: Node): Element | null`, `selectorFor(el: Element): string`, `buildAnnoFields(input: DraftInput): AnnoFields | null`, `SelectionTarget { container; range; rect }` are used consistently across tasks. `composerFields` widened to `AnnoFields | null`.
- **Placeholder scan:** none — every code step shows full code; commands have expected output.
- **Out of scope (this phase):** Shadow DOM, floating button, on/off toggle ownership, embed build, monorepo conversion.
