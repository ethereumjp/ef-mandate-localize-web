# M5 — EAS Read + Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read the comment attestations for the page from EAS (Sepolia), project each onto the current rendered text with M3 `project()`, and render inline span highlights, per-block gutter badges, threaded comment cards, anchor-status indicators, and the "Comment for past version" tag.

**Architecture:** Extend the existing `CommentApp` island. On mount it fetches attestations for the schema UID via the EAS GraphQL API, decodes them (`decodeComment`, M4), filters to the page language, groups by `blockId`, and for each on-page block computes the live `blockHash` from the DOM and runs M3 `project()`. `anchored`/`re-anchored` comments get an inline highlight (CSS Custom Highlight API) + a gutter badge; clicking opens a thread panel (threaded by `parentUid`); `needs-review`/`orphaned` land in an "unanchored" section. Reuses M1 `normalize`/`hash`, M3 `project`, M4 `decodeComment`/`normalizedBlockText`.

**Tech Stack:** React 19 island + `@tanstack/react-query` (already present) for the fetch; EAS GraphQL via `fetch` (no new dep); `decodeComment` (EAS SDK, M4); CSS Custom Highlight API for inline marks; vitest (jsdom) for the DOM-mapping + pure logic.

---

## Reality check (read first)

- **The live read cannot run in CI.** Querying EAS GraphQL needs the network + the schema UID + attestations that actually exist on Sepolia. So: the **deterministic modules are unit-tested** (decode-mapping with an injected fetch, thread building, offset→DOM range mapping, page projection), and the **fetch + React rendering are verified by `pnpm build` + `pnpm run check:astro` + a manual demo** (Task 8). Don't fake on-chain reads.
- **Reuse, don't reimplement:** M3 `project`/`Anchor` (`src/lib/anchoring.ts`), M1 `normalizeBlockText`/`codePointLength`/`blockHash` (`src/lib/normalize.ts`,`hash.ts`), M4 `decodeComment`/`CommentFields` (`src/web3/schema.ts`), `normalizedBlockText` (`src/web3/selection.ts`), `SCHEMA_UID` (`src/web3/config.ts`).
- **Display policy (decided in the schema review):** `anchored` (live `blockHash` matches) renders inline as current; `re-anchored` (re-located by `spanExact`) renders inline **with the past-version tag**; `needs-review`/`orphaned` are **not** placed inline — they appear in the block's "needs review" panel with the past-version tag.
- **Threading** uses the schema's `parentUid` field (zero = top-level), not EAS's native `refUID`.
- **API drift:** verify the exact EAS GraphQL field/filter names (`schemaId` vs `schema`, `data` field) against `https://sepolia.easscan.org/graphql` before finalizing Task 1; the query below is the intended shape.

## External setup (human, not CI)
- A built site with `PUBLIC_EAS_SCHEMA_UID` set (M4), and **at least one comment posted** on a chapter (via the M4 compose flow) so there is something to read. The M5 manual demo (Task 8) posts one then reloads to see it render.

## File structure (created under `site/`)

- `src/web3/read.ts` — `StoredComment`, `fetchComments(schemaUid, opts)` (EAS GraphQL → decode → `StoredComment[]`; injectable fetch)
- `src/web3/thread.ts` — `CommentNode`, `buildThreads(comments)` (tree by `parentUid`)
- `src/web3/projectComments.ts` — `toAnchor`, `ProjectedComment`, `projectComments(blockEl, comments)` (live `blockHash` + M3 `project`)
- `src/web3/highlight.ts` — `rangeForOffsets(blockEl, start, end)` (normalized offsets → DOM `Range`) + `applyHighlights(entries)` (CSS Custom Highlight API)
- `src/components/comments/AnchorStatusBadge.tsx` — small status pill
- `src/components/comments/CommentCard.tsx` — one comment (quote, author, body, time, status, replies)
- `src/components/comments/CommentThread.tsx` — per-block panel (threaded cards + needs-review section + reply box stub)
- Modified: `src/components/comments/CommentApp.tsx` (fetch + project + render), `src/components/comments/CommentMarker.tsx` (real counts + open), `src/lib/i18n.ts` (status/tag/panel strings), `src/styles/global.css` (`::highlight(...)` styles), `site/README.md` (M5 section). CI workflow unchanged.

---

## Task 1: EAS read module (fetch + decode)

**Files:** Create `site/src/web3/read.ts`; Test `site/tests/read.test.ts`.

- [ ] **Step 1: Write the failing test** (`tests/read.test.ts`) — inject a fake `fetch` returning one attestation whose `data` is produced by `encodeComment`, assert it decodes into a `StoredComment`.
```ts
import { describe, it, expect } from "vitest";
import { fetchComments } from "../src/web3/read";
import { encodeComment, type CommentFields } from "../src/web3/schema";

const fields: CommentFields = {
  chapter: "02", blockId: "02-p7", lang: "ja",
  blockHash: "0x" + "22".repeat(32),
  spanStart: 4, spanEnd: 12, spanExact: "walkaway", spanPrefix: "the ", spanSuffix: " test",
  parentUid: "0x" + "00".repeat(32), body: "なるほど。",
};

function fakeFetch(payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
}

describe("fetchComments", () => {
  it("decodes attestations into StoredComment[]", async () => {
    const payload = {
      data: {
        attestations: [
          { id: "0xUID", attester: "0xabc", time: 1700000000, revoked: false, data: encodeComment(fields) },
        ],
      },
    };
    const out = await fetchComments("0xSCHEMA", { fetchImpl: fakeFetch(payload) });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ uid: "0xUID", attester: "0xabc", time: 1700000000, blockId: "02-p7", spanExact: "walkaway", body: "なるほど。" });
  });

  it("returns [] when there are no attestations", async () => {
    const out = await fetchComments("0xSCHEMA", { fetchImpl: fakeFetch({ data: { attestations: [] } }) });
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm exec vitest run tests/read.test.ts`.

- [ ] **Step 3: Implement `site/src/web3/read.ts`**
```ts
import { decodeComment, type CommentFields } from "./schema";

export interface StoredComment extends CommentFields {
  uid: string;
  attester: string;
  time: number; // unix seconds
}

const EAS_GRAPHQL = "https://sepolia.easscan.org/graphql";

const QUERY = `query Comments($schemaId: String!) {
  attestations(
    where: { schemaId: { equals: $schemaId }, revoked: { equals: false } }
    orderBy: { time: asc }
  ) { id attester time revoked data }
}`;

interface RawAttestation {
  id: string;
  attester: string;
  time: number;
  revoked: boolean;
  data: string;
}

/** Fetch + decode all non-revoked comment attestations for a schema. */
export async function fetchComments(
  schemaUid: string,
  opts: { endpoint?: string; fetchImpl?: typeof fetch } = {},
): Promise<StoredComment[]> {
  if (!schemaUid) return [];
  const f = opts.fetchImpl ?? fetch;
  const res = await f(opts.endpoint ?? EAS_GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { schemaId: schemaUid } }),
  });
  if (!res.ok) throw new Error(`EAS GraphQL ${res.status}`);
  const json = (await res.json()) as { data?: { attestations?: RawAttestation[] } };
  const rows = json.data?.attestations ?? [];
  return rows.map((a) => ({
    uid: a.id,
    attester: a.attester,
    time: Number(a.time),
    ...decodeComment(a.data),
  }));
}
```
(If the live EASScan schema uses different field/filter names, adjust QUERY + the parse path so the test's injected shape still drives the mapping; the test is the contract for the decode mapping.)

- [ ] **Step 4: Run, confirm PASS** — `pnpm exec vitest run tests/read.test.ts` (2 tests).

- [ ] **Step 5: Gate + commit** — `pnpm run typecheck` (0), `pnpm run lint` (0), `pnpm run fmt` then `fmt:check` (0).
```bash
git add site/src/web3/read.ts site/tests/read.test.ts
git commit -m "feat(site): EAS GraphQL read + decode into StoredComment[]"
```

---

## Task 2: Thread building

**Files:** Create `site/src/web3/thread.ts`; Test `site/tests/thread.test.ts`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from "vitest";
import { buildThreads } from "../src/web3/thread";
import type { StoredComment } from "../src/web3/read";

const ZERO = "0x" + "00".repeat(32);
function c(uid: string, parentUid: string, body: string): StoredComment {
  return {
    uid, parentUid, body, attester: "0xa", time: 0,
    chapter: "02", blockId: "02-p7", lang: "ja",
    blockHash: "0x" + "22".repeat(32),
    spanStart: 0, spanEnd: 1, spanExact: "x", spanPrefix: "", spanSuffix: "",
  };
}

describe("buildThreads", () => {
  it("nests replies under their parent; top-level = zero parentUid", () => {
    const tree = buildThreads([c("0x1", ZERO, "root"), c("0x2", "0x1", "reply"), c("0x3", ZERO, "root2")]);
    expect(tree.map((n) => n.comment.uid)).toEqual(["0x1", "0x3"]);
    expect(tree[0].replies.map((n) => n.comment.uid)).toEqual(["0x2"]);
  });

  it("treats a reply to an unknown parent as top-level", () => {
    const tree = buildThreads([c("0x2", "0xUNKNOWN", "orphanReply")]);
    expect(tree.map((n) => n.comment.uid)).toEqual(["0x2"]);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `site/src/web3/thread.ts`**
```ts
import type { StoredComment } from "./read";

export interface CommentNode {
  comment: StoredComment;
  replies: CommentNode[];
}

const ZERO_UID = "0x" + "00".repeat(32);

/** Build reply trees by `parentUid`. Zero parent (or unknown parent) = top-level. */
export function buildThreads(comments: StoredComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  for (const c of comments) nodes.set(c.uid, { comment: c, replies: [] });

  const roots: CommentNode[] = [];
  for (const c of comments) {
    const node = nodes.get(c.uid)!;
    const parent = c.parentUid !== ZERO_UID ? nodes.get(c.parentUid) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}
```

- [ ] **Step 4: Run, confirm PASS** (2 tests).

- [ ] **Step 5: Gate + commit**
```bash
git add site/src/web3/thread.ts site/tests/thread.test.ts
git commit -m "feat(site): build comment reply threads by parentUid"
```

---

## Task 3: Offset → DOM highlight range

**Files:** Create `site/src/web3/highlight.ts`; Test `site/tests/highlight.test.ts` (jsdom). This is the inverse of M4's `selection.ts` and the trickiest pure logic.

- [ ] **Step 1: Write the failing test**
```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { rangeForOffsets } from "../src/web3/highlight";

function blockEl(html: string) {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

describe("rangeForOffsets", () => {
  it("maps normalized offsets to a DOM range over plain text", () => {
    const el = blockEl("the walkaway test"); // normalized == raw
    const r = rangeForOffsets(el, 4, 12);
    expect(r?.toString()).toBe("walkaway");
  });

  it("accounts for leading-whitespace trim", () => {
    const el = blockEl("  the walkaway test"); // 2 leading spaces trimmed by normalize
    const r = rangeForOffsets(el, 4, 12);
    expect(r?.toString()).toBe("walkaway");
  });

  it("spans across inline element boundaries", () => {
    const el = blockEl("a <strong>bold</strong> word"); // textContent "a bold word"
    const r = rangeForOffsets(el, 2, 6); // "bold"
    expect(r?.toString()).toBe("bold");
  });

  it("returns null for an out-of-range span", () => {
    const el = blockEl("abc");
    expect(rangeForOffsets(el, 1, 99)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `site/src/web3/highlight.ts`**
```ts
import { normalizeBlockText, codePointLength } from "../lib/normalize";

/** Count leading code points that normalization trims from the block's raw text. */
function leadingTrim(blockEl: Element): number {
  const raw = blockEl.textContent ?? "";
  const norm = normalizeBlockText(raw);
  const rawCps = [...raw];
  const normCps = [...norm];
  if (normCps.length === 0) return rawCps.length;
  let i = 0;
  while (i < rawCps.length && rawCps[i] !== normCps[0]) i++;
  return i;
}

/** Walk text nodes to the (node, nodeOffset) at a given code-point index into textContent. */
function locate(blockEl: Element, rawCpIndex: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let remaining = rawCpIndex;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const cps = [...node.data];
    if (remaining <= cps.length) {
      // UTF-16 offset for the first `remaining` code points of this node.
      const utf16 = cps.slice(0, remaining).join("").length;
      return { node, offset: utf16 };
    }
    remaining -= cps.length;
    node = walker.nextNode() as Text | null;
  }
  return null;
}

/** A DOM Range for normalized code-point [start,end) within blockEl, or null if unplaceable. */
export function rangeForOffsets(blockEl: Element, start: number, end: number): Range | null {
  if (start < 0 || end <= start) return null;
  const lead = leadingTrim(blockEl);
  const a = locate(blockEl, start + lead);
  const b = locate(blockEl, end + lead);
  if (!a || !b) return null;
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  return range;
}

/** Register highlight ranges via the CSS Custom Highlight API (browser only). */
export function applyHighlights(name: string, ranges: Range[]): void {
  const g = globalThis as unknown as {
    CSS?: { highlights?: Map<string, unknown> };
    Highlight?: new (...r: Range[]) => unknown;
  };
  if (!g.CSS?.highlights || !g.Highlight) return; // unsupported → no inline highlight
  if (ranges.length === 0) {
    g.CSS.highlights.delete(name);
    return;
  }
  g.CSS.highlights.set(name, new g.Highlight(...ranges));
}
```
(Note: the normalized→raw mapping only compensates for leading trim — exact for the Mandate's plain prose; rich blocks with collapsed interior whitespace share the documented M4-5 caveat. The jsdom test covers the plain + inline-element + leading-ws cases.)

- [ ] **Step 4: Run, confirm PASS** (4 tests).

- [ ] **Step 5: Gate + commit**
```bash
git add site/src/web3/highlight.ts site/tests/highlight.test.ts
git commit -m "feat(site): map comment span offsets to a DOM range (CSS highlight)"
```

---

## Task 4: Page projection

**Files:** Create `site/src/web3/projectComments.ts`; Test `site/tests/projectComments.test.ts` (jsdom).

- [ ] **Step 1: Write the failing test**
```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { projectComments, toAnchor } from "../src/web3/projectComments";
import { normalizedBlockText } from "../src/web3/selection";
import { blockHash } from "../src/lib/hash";
import type { StoredComment } from "../src/web3/read";

function stored(over: Partial<StoredComment>): StoredComment {
  return {
    uid: "0x1", attester: "0xa", time: 0, chapter: "02", blockId: "02-p7", lang: "ja",
    blockHash: "0x" + "00".repeat(32), spanStart: 4, spanEnd: 12,
    spanExact: "walkaway", spanPrefix: "the ", spanSuffix: " test",
    parentUid: "0x" + "00".repeat(32), body: "x", ...over,
  };
}

describe("projectComments", () => {
  it("marks a comment whose blockHash matches the live text as anchored", () => {
    const el = document.createElement("div");
    el.textContent = "the walkaway test";
    const liveHash = blockHash(normalizedBlockText(el));
    const out = projectComments(el, [stored({ blockHash: liveHash })]);
    expect(out[0].projection.status).toBe("anchored");
    expect(out[0].projection.start).toBe(4);
  });

  it("re-anchors when the block changed but the quote still exists", () => {
    const el = document.createElement("div");
    el.textContent = "see the walkaway test now"; // different text/hash, quote present
    const out = projectComments(el, [stored({ blockHash: "0x" + "ab".repeat(32) })]);
    expect(out[0].projection.status).toBe("re-anchored");
    expect(out[0].projection.pastVersion).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL.**

- [ ] **Step 3: Implement `site/src/web3/projectComments.ts`**
```ts
import { project, type Anchor, type Projection } from "../lib/anchoring";
import { blockHash } from "../lib/hash";
import { normalizedBlockText } from "./selection";
import type { StoredComment } from "./read";

/** A stored comment as an M3 Anchor. */
export function toAnchor(c: StoredComment): Anchor {
  return {
    blockHash: c.blockHash as `0x${string}`,
    exact: c.spanExact,
    prefix: c.spanPrefix,
    suffix: c.spanSuffix,
    start: c.spanStart,
    end: c.spanEnd,
  };
}

export interface ProjectedComment {
  comment: StoredComment;
  projection: Projection;
}

/** Project comments (already filtered to this block) onto the block's live text. */
export function projectComments(blockEl: Element, comments: StoredComment[]): ProjectedComment[] {
  const text = normalizedBlockText(blockEl);
  const current = { blockHash: blockHash(text), text };
  return comments.map((c) => ({ comment: c, projection: project(toAnchor(c), current) }));
}
```

- [ ] **Step 4: Run, confirm PASS** (2 tests).

- [ ] **Step 5: Gate + commit**
```bash
git add site/src/web3/projectComments.ts site/tests/projectComments.test.ts
git commit -m "feat(site): project stored comments onto live block text"
```

---

## Task 5: i18n strings + AnchorStatusBadge

**Files:** Modify `site/src/lib/i18n.ts`; Create `site/src/components/comments/AnchorStatusBadge.tsx`.

- [ ] **Step 1: Add i18n keys** to BOTH `en` and `ja` in `MESSAGES` (keep keys identical across languages):
```ts
// en
comments: "Comments", // (exists)
pastVersion: "Comment for past version",
statusReanchored: "Re-anchored",
statusNeedsReview: "Needs review",
statusOrphaned: "Block removed",
reply: "Reply",
threadTitle: "Comments",
noComments: "No comments on this block yet.",
needsReviewTitle: "Needs review (text changed)",
// ja
pastVersion: "過去のバージョンに対するコメント",
statusReanchored: "再アンカリング",
statusNeedsReview: "要確認",
statusOrphaned: "ブロックが削除されました",
reply: "返信",
threadTitle: "コメント",
noComments: "このブロックにはまだコメントがありません。",
needsReviewTitle: "要確認（本文が変更されました）",
```
(`MessageKey` is derived from `en`, so adding to both keeps the parity test green.)

- [ ] **Step 2: Create `AnchorStatusBadge.tsx`** — a tiny pill from an `AnchorStatus` + lang. `anchored` → render nothing (current). `re-anchored` → amber "Re-anchored". `needs-review` → amber "Needs review". `orphaned` → stone "Block removed". Pull labels from `MESSAGES[lang]`. Tailwind + dark variants.

- [ ] **Step 3: Gate** — `pnpm run typecheck` (0), `pnpm test` (the i18n parity test still passes), `pnpm run lint`/`fmt:check` (0), `pnpm run check:astro` (0).

- [ ] **Step 4: Commit**
```bash
git add site/src/lib/i18n.ts site/src/components/comments/AnchorStatusBadge.tsx
git commit -m "feat(site): comment status/thread i18n strings + AnchorStatusBadge"
```

---

## Task 6: CommentCard + CommentThread

**Files:** Create `site/src/components/comments/CommentCard.tsx`, `site/src/components/comments/CommentThread.tsx`. **Integration task** — build + check + manual.

- [ ] **Step 1: `CommentCard.tsx`** — props `{ node: CommentNode, projection?: Projection, lang }`. Renders: the quoted excerpt (`comment.spanExact`) as a blockquote; a short author (ENS not resolved yet → `0x1234…abcd`); the `body`; the time (`new Date(time*1000).toLocaleDateString()`); an `<AnchorStatusBadge>` + the localized `pastVersion` tag when `projection?.pastVersion`; then its `replies` rendered as indented `CommentCard`s (recursive). A disabled "Reply" affordance (full reply compose is deferred — link to M4's composer later). Tailwind + dark.

- [ ] **Step 2: `CommentThread.tsx`** — props `{ blockId, projected: ProjectedComment[], lang, onClose }`. Splits `projected` into inline-capable (`anchored`/`re-anchored`) and `needsReview` (`needs-review`/`orphaned`); builds threads with `buildThreads` over each group's comments; renders a titled panel (`threadTitle`) of top-level `CommentCard`s, plus a `needsReviewTitle` section for the unanchored ones; `noComments` when empty. (Panel can be a simple fixed side panel / Base UI Dialog — reuse the Composer's dialog styling.)

- [ ] **Step 3: Verify** — `pnpm run typecheck` (0), `pnpm run lint`/`fmt:check` (0), `pnpm run check:astro` (0), `pnpm build` (2 pages).

- [ ] **Step 4: Commit**
```bash
git add site/src/components/comments/CommentCard.tsx site/src/components/comments/CommentThread.tsx
git commit -m "feat(site): comment thread panel + threaded comment cards"
```

---

## Task 7: Wire read + projection + render into CommentApp

**Files:** Modify `site/src/components/comments/CommentApp.tsx`, `site/src/components/comments/CommentMarker.tsx`, `site/src/styles/global.css`. **Integration task** — build + check + manual.

- [ ] **Step 1: highlight styles** in `global.css`:
```css
::highlight(comment) {
  background-color: var(--color-amber-200);
}
[data-theme="dark"] ::highlight(comment) {
  background-color: color-mix(in oklab, var(--color-amber-500) 40%, transparent);
}
```

- [ ] **Step 2: CommentApp read path** — inside `CommentController` (within the providers), add:
  - `const { data: stored = [] } = useQuery({ queryKey: ["comments", SCHEMA_UID], queryFn: () => fetchComments(SCHEMA_UID), enabled: !!SCHEMA_UID })` (react-query is already provided).
  - Merge `stored` with the M4 optimistic `comments` (dedupe by `uid`; drop optimistic ones whose `uid` now appears in `stored`).
  - Filter to the page `lang`; group by `blockId`.
  - For each on-page `[data-block-id]` element, `projectComments(blockEl, group)`; collect inline ranges via `rangeForOffsets(blockEl, p.projection.start, p.projection.end)` for `anchored`/`re-anchored` (non-null offsets) and `applyHighlights("comment", ranges)` in an effect after render.
  - Portal a `<CommentMarker count={...} pending={...} onClick={openThread}/>` into each commented block's `.gutter`.
  - Track an open thread (`blockId | null`); render `<CommentThread blockId projected lang onClose/>` for the open block.
  - Re-run projection/highlights when `stored`, `comments`, or `data-comments` change.
- [ ] **Step 3: CommentMarker** — accept `{ count, pending, onClick }`; render the 💬 + count badge (pending dot when an optimistic write is in flight) as a button that calls `onClick`.
- [ ] **Step 4: Verify** — `pnpm run lint`/`fmt:check`/`typecheck` (0), `pnpm run check:astro` (0), `pnpm build` (2 pages; `grep -rlE "spanPrefix,string spanSuffix" site/dist/` still non-empty; `grep -rl "node:fs" site/dist/` empty), `pnpm test` (still green).
- [ ] **Step 5: Commit**
```bash
git add site/src/components/comments/CommentApp.tsx site/src/components/comments/CommentMarker.tsx site/src/styles/global.css
git commit -m "feat(site): read attestations, project, highlight spans + gutter threads"
```

---

## Task 8: Docs, final verify, manual demo

**Files:** Modify `site/README.md`, `site/docs/m4-demo-checklist.md` (or a new M5 note).

- [ ] **Step 1: README "Reading comments (M5)"** — append: comments are read from EAS GraphQL (Sepolia) by schema UID, decoded, projected onto the current text (M3), and shown as inline highlights + gutter badges + threads; status tags (`re-anchored`/`needs-review`/`orphaned`) and the localized "Comment for past version"; needs the same `PUBLIC_EAS_SCHEMA_UID`.

- [ ] **Step 2: Full local gate** — `pnpm run lint` (0) · `fmt:check` (0) · `typecheck` (0) · `check:astro` (0) · `pnpm test` (report count: read+thread+highlight+projectComments added) · `pnpm build` (2 pages).

- [ ] **Step 3: Manual demo checklist** (record in README/docs + report; needs a wallet + the schema UID):
  1. With `PUBLIC_EAS_SCHEMA_UID` set, `pnpm dev`; comments **on**; connect wallet (Sepolia).
  2. Post a comment on a phrase in chapter 02 (M4 flow); approve tx; wait for confirmation.
  3. Reload — the comment now renders from chain: the phrase is **highlighted**, the block's **gutter badge** shows a count, clicking it opens the **thread** with the quote/body/author/time.
  4. Edit the JA source for that block + rebuild (or use the `reanchor:demo` mental model) → the comment shows **"Comment for past version"** with a `re-anchored`/`needs-review` status as appropriate.

- [ ] **Step 4: Commit**
```bash
git add site/README.md site/docs/m4-demo-checklist.md
git commit -m "docs(site): M5 reading-comments setup + manual demo"
```

---

## Self-Review notes (for the planner)

- **Spec coverage (M5 = §16 "EAS read + projection"):** query by schema UID (Task 1); project to current version (Task 4 via M3 `project`); gutter badges + threads + anchor-status indicators (Tasks 5–7); inline highlight of the span (Tasks 3, 7); "Comment for past version" localized tag (Tasks 5–7, §9/§12); threading by `parentUid` (Task 2). Display policy (anchored/re-anchored inline; needs-review/orphaned in a panel) per the schema-review decision.
- **Reuse:** M3 `project`/`Anchor`, M1 `normalize`/`hash`, M4 `decodeComment`/`normalizedBlockText`/`SCHEMA_UID`/`Composer` dialog styling — no reimplementation. `read.ts`→`StoredComment` extends M4 `CommentFields`.
- **Testing honesty:** Tasks 1–4 unit-tested (injected-fetch decode, threads, jsdom offset→range, jsdom projection). Tasks 6–7 build/check + manual (live GraphQL + rendering). Called out up top.
- **Type consistency:** `StoredComment` (read.ts) = `CommentFields` + `{uid,attester,time}`; `CommentNode` (thread.ts) wraps it; `ProjectedComment` (projectComments.ts) = `{comment, projection}`; `toAnchor` maps to M3 `Anchor`; `rangeForOffsets` consumes `projection.start/end`. `applyHighlights` name `"comment"` matches the `::highlight(comment)` CSS.
- **Deferred (future):** ENS name/avatar resolution for authors; full reply compose (parentUid wired but the composer reuse is a stub); revoke UI; pagination/large-scale querying; off-chain/Merkle read; the rich-markup highlight edge cases (shared M4-5 caveat).
