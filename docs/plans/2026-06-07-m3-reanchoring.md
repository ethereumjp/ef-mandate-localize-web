# M3 — Re-anchoring Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pure, shared TypeScript module that turns a comment's stored anchor + the current block text into a projection status — `anchored` / `re-anchored` / `needs-review` / `orphaned` (plus a `pastVersion` flag = the "Comment for past version" tag) — so M5 can place immutable comments on the current version and M4 can build the anchor when a comment is authored.

**Architecture:** One framework-free module `site/src/lib/anchoring.ts`. `makeAnchor(blockHash, text, start, end)` builds the W3C-style selector (exact quote + prefix/suffix context + code-point offsets) at authoring time. `project(anchor, currentBlock|null)` classifies: block gone → `orphaned`; block hash unchanged → `anchored` (offsets valid verbatim); block changed → re-match the exact quote (disambiguating multiple hits via prefix/suffix context) → unique hit → `re-anchored`, else → `needs-review`. All offsets are Unicode code points (consistent with M1 normalization). Reuses M1 `hash`/`anchors` only in the integration test/demo.

**Tech Stack:** TypeScript, vitest. Pure (no IO, no DOM, no chain). Designed to run identically in Node (build/projection) and the browser (M4/M5).

---

## Context for the implementer

- Work in `site/` (run pnpm from there). Branch `feat/commentary` is checked out — work in place, no worktree.
- This module is the projection half of the spec's edit-handling model (spec §9) and the anchoring model (spec §6, three-layer pointer). M3 builds ONLY the pure logic + a demonstration. No EAS, no wallet, no UI (those are M4/M5).
- Inputs come from two places later: the **anchor** is what an EAS attestation stores (spec §7 fields `spanExact`/`spanPrefix`/`spanSuffix`/`spanStart`/`spanEnd`/`blockHash`); the **current block** is what M1's `anchors.json` provides per `blockId` (`{ normalizedText, blockHash }`). M3 models these as plain types; M4/M5 map their data onto them.
- Offsets are **Unicode code-point** indices over a block's **normalized** text (same normalization as M1 `normalizeBlockText`). Use `Array.from(s)` / `[...s]` for code-point arrays, never UTF-16 `string.indexOf`.
- Reuse M1 where relevant: `site/src/lib/hash.ts` (`blockHashFromNormalized`) and `site/src/lib/anchors.ts` (`buildChapterAnchors`) in the integration test/demo. Do not reimplement hashing/normalization.
- `git` is transparently proxied — run normally. Commit messages must NOT include any AI co-author trailer.
- TDD for every function. Run one test file: `pnpm exec vitest run tests/anchoring.test.ts`.

## File Structure

Created under `site/`:
- `src/lib/anchoring.ts` — types (`Anchor`, `CurrentBlock`, `AnchorStatus`, `Projection`), `makeAnchor`, `project`, and private helpers (`codePoints`, `findOccurrences`, `contextMatches`)
- `tests/anchoring.test.ts` — unit tests (helpers, makeAnchor, project incl. disambiguation)
- `tests/anchoring-integration.test.ts` — end-to-end scenario over realistic content using M1's `buildChapterAnchors` (the spec's "demonstrate by editing a chapter", done in-memory with fixtures — NOT by editing real sources)
- `scripts/reanchor-demo.ts` — prints the four outcomes for a scripted edit (in-memory)

Modified:
- `site/package.json` — add `"reanchor:demo"` script
- `site/README.md` — add a "Re-anchoring (M3)" section

---

## Task 1: Module skeleton + code-point helpers

**Files:**
- Create: `site/src/lib/anchoring.ts`
- Test: `site/tests/anchoring.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { findOccurrences, codePoints } from "../src/lib/anchoring";

describe("codePoints", () => {
  it("splits by Unicode code point (astral-safe)", () => {
    expect(codePoints("a\u{1F600}b")).toEqual(["a", "\u{1F600}", "b"]);
  });
});

describe("findOccurrences", () => {
  it("finds all start indices of a subsequence", () => {
    expect(findOccurrences(codePoints("abcabc"), codePoints("bc"))).toEqual([1, 4]);
  });
  it("returns [] when the needle is absent", () => {
    expect(findOccurrences(codePoints("abc"), codePoints("z"))).toEqual([]);
  });
  it("returns [] for an empty needle", () => {
    expect(findOccurrences(codePoints("abc"), codePoints(""))).toEqual([]);
  });
  it("works on code points, not UTF-16 units", () => {
    // The emoji is one code point; "b" sits at index 2.
    expect(findOccurrences(codePoints("a\u{1F600}b"), codePoints("b"))).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anchoring.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/anchoring").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/anchoring.ts
// Pure re-anchoring: project a stored comment anchor onto the current block text.
// All offsets are Unicode code-point indices over NORMALIZED block text
// (same normalization as M1's normalizeBlockText). Runs in Node and the browser.

/** A stored anchor (what an EAS attestation records, spec §6/§7). */
export interface Anchor {
  /** keccak256 of the normalized block text at authoring time. */
  blockHash: `0x${string}`;
  /** The selected substring (the quote). */
  exact: string;
  /** A few code points of context before / after the quote. */
  prefix: string;
  suffix: string;
  /** Code-point offsets of the quote within the normalized block at authoring. */
  start: number;
  end: number;
}

/** The current state of a block (from M1's anchors.json). */
export interface CurrentBlock {
  blockHash: `0x${string}`;
  text: string;
}

export type AnchorStatus = "anchored" | "re-anchored" | "needs-review" | "orphaned";

export interface Projection {
  status: AnchorStatus;
  /** Code-point offsets into the CURRENT block, or null when unplaceable. */
  start: number | null;
  end: number | null;
  /** True when the block changed since authoring (or is gone): the
   *  "Comment for past version" tag. Only `anchored` is ever false. */
  pastVersion: boolean;
}

/** Split a string into an array of Unicode code points. */
export function codePoints(s: string): string[] {
  return Array.from(s);
}

/** All start indices where `needle` occurs in `haystack` (code-point arrays). */
export function findOccurrences(haystack: string[], needle: string[]): number[] {
  const out: number[] = [];
  if (needle.length === 0) return out;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) out.push(i);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anchoring.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/anchoring.ts site/tests/anchoring.test.ts
git commit -m "feat(site): anchoring module skeleton + code-point helpers"
```

---

## Task 2: makeAnchor (authoring-side selector builder)

**Files:**
- Modify: `site/src/lib/anchoring.ts`
- Modify: `site/tests/anchoring.test.ts`

- [ ] **Step 1: Add the failing test** (append to `tests/anchoring.test.ts`)

```ts
import { makeAnchor } from "../src/lib/anchoring";

describe("makeAnchor", () => {
  const H = "0x00" as const;

  it("captures exact + prefix/suffix context from a code-point span", () => {
    const a = makeAnchor(H as `0x${string}`, "The quick brown fox", 4, 9, 3); // "quick"
    expect(a.exact).toBe("quick");
    expect(a.prefix).toBe("he "); // last 3 cps before index 4
    expect(a.suffix).toBe(" br"); // first 3 cps after index 9
    expect(a.start).toBe(4);
    expect(a.end).toBe(9);
    expect(a.blockHash).toBe(H);
  });

  it("clamps context at block edges", () => {
    const a = makeAnchor(H as `0x${string}`, "abcdef", 0, 2, 10); // "ab" at the start
    expect(a.exact).toBe("ab");
    expect(a.prefix).toBe(""); // nothing before index 0
    expect(a.suffix).toBe("cdef"); // only 4 cps available after
  });

  it("uses code points for CJK text", () => {
    const a = makeAnchor(H as `0x${string}`, "財団の役割について", 0, 2, 2); // "財団"
    expect(a.exact).toBe("財団");
    expect(a.prefix).toBe("");
    expect(a.suffix).toBe("の役");
  });

  it("throws on an invalid span", () => {
    expect(() => makeAnchor(H as `0x${string}`, "abc", 2, 2)).toThrow(/invalid span/);
    expect(() => makeAnchor(H as `0x${string}`, "abc", 0, 9)).toThrow(/invalid span/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anchoring.test.ts`
Expected: FAIL ("makeAnchor is not a function" / not exported).

- [ ] **Step 3: Add the implementation** (append to `src/lib/anchoring.ts`)

```ts
/** Default amount of surrounding context (in code points) captured per side. */
export const CONTEXT_LEN = 32;

/**
 * Build an anchor for a [start, end) code-point span of a block's normalized text.
 * Called at authoring time (M4). `blockHash` is the hash of the same normalized text.
 */
export function makeAnchor(
  blockHash: `0x${string}`,
  text: string,
  start: number,
  end: number,
  contextLen: number = CONTEXT_LEN
): Anchor {
  const cps = codePoints(text);
  if (start < 0 || end > cps.length || start >= end) {
    throw new Error(`invalid span [${start}, ${end}) for text of length ${cps.length}`);
  }
  return {
    blockHash,
    exact: cps.slice(start, end).join(""),
    prefix: cps.slice(Math.max(0, start - contextLen), start).join(""),
    suffix: cps.slice(end, end + contextLen).join(""),
    start,
    end,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anchoring.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/anchoring.ts site/tests/anchoring.test.ts
git commit -m "feat(site): makeAnchor selector builder (exact + context + offsets)"
```

---

## Task 3: project — orphaned / anchored / re-anchored / needs-review

**Files:**
- Modify: `site/src/lib/anchoring.ts`
- Modify: `site/tests/anchoring.test.ts`

- [ ] **Step 1: Add the failing test** (append to `tests/anchoring.test.ts`)

```ts
import { project } from "../src/lib/anchoring";

describe("project", () => {
  const H1 = "0x01" as `0x${string}`;
  const H2 = "0x02" as `0x${string}`;

  it("orphaned when the block is gone", () => {
    const a = makeAnchor(H1, "the walkaway test is robust", 4, 12); // "walkaway"
    expect(project(a, null)).toEqual({
      status: "orphaned",
      start: null,
      end: null,
      pastVersion: true,
    });
  });

  it("anchored (offsets verbatim) when the block hash is unchanged", () => {
    const text = "the walkaway test is robust";
    const a = makeAnchor(H1, text, 4, 12);
    expect(project(a, { blockHash: H1, text })).toEqual({
      status: "anchored",
      start: 4,
      end: 12,
      pastVersion: false,
    });
  });

  it("re-anchored when the block changed but the quote moved (unique)", () => {
    const original = "the walkaway test is robust";
    const a = makeAnchor(H1, original, 4, 12); // "walkaway"
    const edited = "we think the walkaway test is robust"; // shifted by 9
    const p = project(a, { blockHash: H2, text: edited });
    expect(p.status).toBe("re-anchored");
    expect(p.pastVersion).toBe(true);
    expect(edited.slice(p.start!, p.end!)).toBe("walkaway");
  });

  it("needs-review when the quoted text is gone", () => {
    const original = "the walkaway test is robust";
    const a = makeAnchor(H1, original, 4, 12); // "walkaway"
    const edited = "the leave test is robust"; // "walkaway" removed
    expect(project(a, { blockHash: H2, text: edited })).toEqual({
      status: "needs-review",
      start: null,
      end: null,
      pastVersion: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anchoring.test.ts`
Expected: FAIL ("project is not a function").

- [ ] **Step 3: Add the implementation** (append to `src/lib/anchoring.ts`)

```ts
/**
 * Project a stored anchor onto the current block (or null if the block is gone).
 * Immutable attestations are never moved; this is the derived current-version view.
 */
export function project(anchor: Anchor, current: CurrentBlock | null): Projection {
  // Block no longer exists in the current version.
  if (current === null) {
    return { status: "orphaned", start: null, end: null, pastVersion: true };
  }

  const pastVersion = anchor.blockHash !== current.blockHash;

  // Block unchanged since authoring → the stored offsets are still valid verbatim.
  if (!pastVersion) {
    return { status: "anchored", start: anchor.start, end: anchor.end, pastVersion: false };
  }

  // Block changed → re-match the quoted span by exact text.
  const cps = codePoints(current.text);
  const exact = codePoints(anchor.exact);
  const candidates = findOccurrences(cps, exact);

  // The quoted text itself was edited or removed — don't guess a location.
  if (candidates.length === 0) {
    return { status: "needs-review", start: null, end: null, pastVersion: true };
  }

  // (Disambiguation of multiple candidates is added in the next task.)
  if (candidates.length > 1) {
    return { status: "needs-review", start: null, end: null, pastVersion: true };
  }

  const idx = candidates[0];
  return { status: "re-anchored", start: idx, end: idx + exact.length, pastVersion: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anchoring.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/anchoring.ts site/tests/anchoring.test.ts
git commit -m "feat(site): project anchor -> status (orphaned/anchored/re-anchored/needs-review)"
```

---

## Task 4: project — disambiguate multiple matches via context

**Files:**
- Modify: `site/src/lib/anchoring.ts`
- Modify: `site/tests/anchoring.test.ts`

- [ ] **Step 1: Add the failing test** (append to `tests/anchoring.test.ts`)

```ts
describe("project — disambiguation", () => {
  const H1 = "0x01" as `0x${string}`;
  const H2 = "0x02" as `0x${string}`;

  it("re-anchors to the context-matching occurrence when the quote repeats", () => {
    // "test" appears twice; the anchor's context ("walkaway " / " is") selects the first.
    const original = "the walkaway test, not the unit test";
    const a = makeAnchor(H1, original, 13, 17); // first "test"
    expect(a.exact).toBe("test");
    // Edited: add a prefix so the block hash changes and offsets shift.
    const edited = "note: the walkaway test, not the unit test";
    const p = project(a, { blockHash: H2, text: edited });
    expect(p.status).toBe("re-anchored");
    expect(p.start).toBe(19); // the first "test" in the edited text
    expect(edited.slice(p.start!, p.end!)).toBe("test");
  });

  it("needs-review when repeated quote can't be disambiguated by context", () => {
    // Two identical occurrences with identical surrounding context.
    const original = "ab xx cd xx ef";
    const a = makeAnchor(H1, original, 3, 5, 0); // "xx", NO context captured
    const edited = "z ab xx cd xx ef";
    expect(project(a, { blockHash: H2, text: edited })).toEqual({
      status: "needs-review",
      start: null,
      end: null,
      pastVersion: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anchoring.test.ts`
Expected: FAIL (the first new test gets `needs-review` because Task 3 returns needs-review for >1 candidates).

- [ ] **Step 3: Update `project` and add the `contextMatches` helper**

In `src/lib/anchoring.ts`, replace the placeholder multi-candidate branch:
```ts
  // (Disambiguation of multiple candidates is added in the next task.)
  if (candidates.length > 1) {
    return { status: "needs-review", start: null, end: null, pastVersion: true };
  }

  const idx = candidates[0];
```
with:
```ts
  let idx: number;
  if (candidates.length === 1) {
    idx = candidates[0];
  } else {
    // Multiple occurrences → keep only those whose surrounding context matches.
    const byContext = candidates.filter((c) =>
      contextMatches(cps, c, exact.length, anchor.prefix, anchor.suffix)
    );
    if (byContext.length !== 1) {
      return { status: "needs-review", start: null, end: null, pastVersion: true };
    }
    idx = byContext[0];
  }
```

Then append the helper:
```ts
/** Does the text around `idx` match the anchor's captured prefix/suffix context? */
function contextMatches(
  cps: string[],
  idx: number,
  exactLen: number,
  prefix: string,
  suffix: string
): boolean {
  const pre = codePoints(prefix);
  const suf = codePoints(suffix);
  // Compare as many context code points as are available on each side.
  const k = Math.min(pre.length, idx);
  for (let j = 0; j < k; j++) {
    if (cps[idx - k + j] !== pre[pre.length - k + j]) return false;
  }
  const end = idx + exactLen;
  const m = Math.min(suf.length, cps.length - end);
  for (let j = 0; j < m; j++) {
    if (cps[end + j] !== suf[j]) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anchoring.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/anchoring.ts site/tests/anchoring.test.ts
git commit -m "feat(site): disambiguate repeated quotes via prefix/suffix context"
```

---

## Task 5: Integration scenario + demo + docs

**Files:**
- Create: `site/tests/anchoring-integration.test.ts`
- Create: `site/scripts/reanchor-demo.ts`
- Modify: `site/package.json` (add `reanchor:demo` script)
- Modify: `site/README.md`

- [ ] **Step 1: Write the integration test** `site/tests/anchoring-integration.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildChapterAnchors } from "../src/lib/anchors";
import { makeAnchor, project } from "../src/lib/anchoring";

// Two blocks. We author a comment on a quote in block 02-p2, then exercise the
// four projection outcomes by editing the chapter in memory (NOT on disk).
const ORIGINAL =
  "<!-- block: 02-p1 -->\n# II. Our Role\n\n" +
  "<!-- block: 02-p2 -->\nOur ultimate goal is for Ethereum to pass the walkaway test.";

function blockOf(source: string, id: string) {
  const a = buildChapterAnchors(source);
  return a[id] ?? null;
}

describe("anchoring integration", () => {
  // Author the anchor against the ORIGINAL 02-p2.
  const orig = buildChapterAnchors(ORIGINAL)["02-p2"];
  const quoteStart = orig.text.indexOf("walkaway");
  const start = [...orig.text.slice(0, quoteStart)].length;
  const end = start + "walkaway".length;
  const anchor = makeAnchor(orig.blockHash, orig.text, start, end); // quote: "walkaway"

  it("anchored: the commented block is unchanged (another block edited)", () => {
    const edited =
      "<!-- block: 02-p1 -->\n# II. Our Role (revised)\n\n" +
      "<!-- block: 02-p2 -->\nOur ultimate goal is for Ethereum to pass the walkaway test.";
    const p = project(anchor, blockOf(edited, "02-p2"));
    expect(p.status).toBe("anchored");
    expect(p.pastVersion).toBe(false);
  });

  it("re-anchored: the commented block changed but the quote survives", () => {
    const edited =
      "<!-- block: 02-p1 -->\n# II. Our Role\n\n" +
      "<!-- block: 02-p2 -->\nUltimately, Ethereum must pass the walkaway test someday.";
    const cur = blockOf(edited, "02-p2");
    const p = project(anchor, cur);
    expect(p.status).toBe("re-anchored");
    expect(p.pastVersion).toBe(true);
    expect(cur!.text.slice(p.start!, p.end!)).toBe("walkaway");
  });

  it("needs-review: the quoted word was rewritten", () => {
    const edited =
      "<!-- block: 02-p1 -->\n# II. Our Role\n\n" +
      "<!-- block: 02-p2 -->\nOur ultimate goal is for Ethereum to pass the leave test.";
    const p = project(anchor, blockOf(edited, "02-p2"));
    expect(p.status).toBe("needs-review");
    expect(p.pastVersion).toBe(true);
  });

  it("orphaned: the commented block was removed", () => {
    const edited = "<!-- block: 02-p1 -->\n# II. Our Role";
    const p = project(anchor, blockOf(edited, "02-p2"));
    expect(p.status).toBe("orphaned");
    expect(p.pastVersion).toBe(true);
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `pnpm exec vitest run tests/anchoring-integration.test.ts`
Expected: PASS (4 tests — anchored, re-anchored, needs-review, orphaned).

- [ ] **Step 3: Write the demo CLI** `site/scripts/reanchor-demo.ts`

```ts
// In-memory demonstration of the four re-anchoring outcomes. No files are touched.
import { buildChapterAnchors } from "../src/lib/anchors";
import { makeAnchor, project, type CurrentBlock } from "../src/lib/anchoring";

const base = (p2: string) =>
  `<!-- block: 02-p1 -->\n# II. Our Role\n\n<!-- block: 02-p2 -->\n${p2}`;

const ORIGINAL_P2 = "Our ultimate goal is for Ethereum to pass the walkaway test.";

const orig = buildChapterAnchors(base(ORIGINAL_P2))["02-p2"];
const qs = [...orig.text.slice(0, orig.text.indexOf("walkaway"))].length;
const anchor = makeAnchor(orig.blockHash, orig.text, qs, qs + "walkaway".length);

function blockOf(p2: string | null): CurrentBlock | null {
  if (p2 === null) return null;
  return buildChapterAnchors(base(p2))["02-p2"] ?? null;
}

const scenarios: Array<[string, string | null]> = [
  ["unchanged block", ORIGINAL_P2],
  ["block edited, quote survives", "Ultimately, Ethereum must pass the walkaway test someday."],
  ["quote rewritten", "Our ultimate goal is for Ethereum to pass the leave test."],
  ["block removed", null],
];

console.log(`anchor: "${anchor.exact}" @ [${anchor.start},${anchor.end}) of 02-p2\n`);
for (const [label, p2] of scenarios) {
  const p = project(anchor, blockOf(p2));
  const tag = p.pastVersion ? " [past version]" : "";
  const at = p.start !== null ? ` @ [${p.start},${p.end})` : "";
  console.log(`${label.padEnd(32)} -> ${p.status}${at}${tag}`);
}
```

- [ ] **Step 4: Add the `reanchor:demo` script to `site/package.json`**

Add this line to the `"scripts"` block (after `"anchors:build"`):
```json
    "reanchor:demo": "tsx scripts/reanchor-demo.ts",
```

- [ ] **Step 5: Run the demo**

Run (from `site/`): `pnpm run reanchor:demo`
Expected output (the four outcomes):
```
anchor: "walkaway" @ [46,54) of 02-p2

unchanged block                  -> anchored @ [46,54)
block edited, quote survives     -> re-anchored @ [35,43) [past version]
quote rewritten                  -> needs-review [past version]
block removed                    -> orphaned [past version]
```
(The exact offsets are illustrative and may differ; what matters is the four statuses and that only the first lacks `[past version]`.)

- [ ] **Step 6: Append a "Re-anchoring (M3)" section to `site/README.md`**

```markdown
## Re-anchoring (M3)

`src/lib/anchoring.ts` is the pure module the commentary layer uses to keep comments
attached to text across edits (spec §6/§9):

- `makeAnchor(blockHash, text, start, end)` — build a comment's anchor at authoring time:
  the exact quote, a little prefix/suffix context, and code-point offsets.
- `project(anchor, currentBlock | null)` — classify against the current text:
  - `anchored` — block hash unchanged; offsets valid as-is.
  - `re-anchored` — block changed but the quote was re-located (uniquely, using context).
  - `needs-review` — the quote is gone or ambiguous; surfaced to humans, never guessed.
  - `orphaned` — the block itself no longer exists.
  Every status except `anchored` sets `pastVersion: true` (the "Comment for past version"
  tag). Attestations are immutable; this is the derived current-version view.

`pnpm run reanchor:demo` prints the four outcomes for a scripted in-memory edit.
```

- [ ] **Step 7: Full local gate + commit**

Run (from `site/`): `pnpm test` → all pass (expect 14 test files now). `pnpm run typecheck` → exit 0. `pnpm run reanchor:demo` → prints the four outcomes.
```bash
git add site/tests/anchoring-integration.test.ts site/scripts/reanchor-demo.ts site/package.json site/README.md
git commit -m "test(site): re-anchoring integration scenario + demo + docs"
```

---

## Self-Review notes (for the planner)

- **Spec coverage (M3 = the re-anchoring module + demonstrate the four states):** `makeAnchor` (Task 2) builds the spec §6 Layer-3 selector; `project` (Tasks 3–4) implements the spec §9 lifecycle (orphaned / anchored / re-anchored / needs-review) and the `pastVersion` "Comment for past version" tag; the integration test + demo (Task 5) demonstrate all four outcomes via in-memory edits to a chapter-02-shaped fixture (not the real source — that would corrupt content and isn't needed).
- **Reuse, not duplication:** offsets/normalization match M1 (code points; the integration test/demo get `text`+`blockHash` from M1's `buildChapterAnchors`). No hashing/parsing reimplemented.
- **Deliberate scope limits (documented):** when the exact quote is absent, `project` returns `needs-review` rather than guessing a span from prefix/suffix alone — conservative by design (spec: "ambiguous / not found → needs-review"). Prefix/suffix are used to *disambiguate* repeats, not to fabricate locations.
- **Consumes / consumed by:** M4 will call `makeAnchor` when a comment is created and store its fields in the EAS attestation (spec §7); M5 will call `project` against `anchors.json` to render comments on the current version with their status + past-version tag. M3 ships neither chain nor UI.
- **Type consistency:** `Anchor` / `CurrentBlock` / `AnchorStatus` / `Projection` are defined once in Task 1 and used unchanged in Tasks 2–5; `project` is introduced in Task 3 and only its multi-candidate branch is revised in Task 4.
