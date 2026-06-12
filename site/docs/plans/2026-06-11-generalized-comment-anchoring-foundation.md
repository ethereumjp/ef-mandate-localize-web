# Generalized Comment Anchoring Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the extension-agnostic library layer (`site/src/anno/`) that lets a comment be anchored to any web page — a generalized EAS schema codec, deterministic URL canonicalization, CSS-selector generation/resolution, and span projection — without touching the live translation site or its registered schema.

**Architecture:** A new `site/src/anno/` namespace holds the generalized layer in parallel with the existing translation-specific `web3/` code. It reuses the already-pure modules `lib/anchoring.ts` (projection), `lib/hash.ts` (keccak256), `lib/normalize.ts` + `web3/selection.ts` (text normalization & selection→offsets) verbatim. Read-time and author-time are separate modules (`locate.ts`, `author.ts`). Everything is unit-tested with vitest; DOM-dependent code uses the `// @vitest-environment jsdom` pragma already used by `tests/projectComments.test.ts`.

**Tech Stack:** TypeScript (ESM), vitest 2 + jsdom 29, viem (keccak256), `@ethereum-attestation-service/eas-sdk` (SchemaEncoder), pnpm.

**Scope note (read first):** This is Plan 1 of a 3-plan decomposition. Out of scope here (separate future plans): Plan 2 = Chrome extension scaffold (manifest v3, content script, background, porting the React comment UI). Plan 3 = migrating the existing translation site onto this generalized schema (re-register schema, dual-read existing comments). Plan 1 ships a self-contained, tested library only.

**Spec:** `site/docs/specs/2026-06-11-generalized-comment-schema-design.md`

**Conventions:**
- All commands run from the `site/` directory.
- Single-file test run: `pnpm exec vitest run <path>`.
- Commit style follows the repo: `feat(site): …`.
- `includeCoAuthoredBy` is false — do not add a co-author trailer.

---

## File Structure

**Create:**
- `site/src/anno/constants.ts` — the generalized EAS schema string (`ANNO_SCHEMA`).
- `site/src/anno/schema.ts` — `AnnoFields` interface + `encodeAnno` / `decodeAnno` codec.
- `site/src/anno/canonicalUrl.ts` — `canonicalizeUrl()` deterministic URL normalization + `TRACKING_PARAMS`.
- `site/src/anno/selector.ts` — `nearestContainer`, `selectorFor`, `generateSelector`, `resolveContainer`, `findByQuote`.
- `site/src/anno/author.ts` — `buildAnnoFields()` (selection → full `AnnoFields` at authoring time).
- `site/src/anno/locate.ts` — `StoredAnno`, `LocatedAnno`, `locate()` (stored comment → projected span at read time).
- `site/scripts/register-anno-schema.ts` — one-off Sepolia registration of `ANNO_SCHEMA`.
- Tests: `site/tests/anno.schema.test.ts`, `site/tests/anno.canonicalUrl.test.ts`, `site/tests/anno.selector.test.ts`, `site/tests/anno.author.test.ts`, `site/tests/anno.locate.test.ts`.

**Modify:**
- `site/package.json` — add `anno:schema:register` script.

**Reuse unchanged:** `site/src/lib/anchoring.ts`, `site/src/lib/hash.ts`, `site/src/lib/normalize.ts`, `site/src/web3/selection.ts`.

---

## Task 1: Generalized EAS schema codec

**Files:**
- Create: `site/src/anno/constants.ts`
- Create: `site/src/anno/schema.ts`
- Test: `site/tests/anno.schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `site/tests/anno.schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { encodeAnno, decodeAnno, type AnnoFields } from "../src/anno/schema";

const fields: AnnoFields = {
  url: "https://example.com/post?id=42",
  urlCanonical: "https://example.com/post?id=42",
  origin: "https://example.com",
  lang: "en",
  rootSelector: '[id="main"] > p:nth-of-type(3)',
  containerHash: "0x" + "22".repeat(32),
  spanStart: 4,
  spanEnd: 12,
  spanExact: "walkaway",
  spanPrefix: "the ",
  spanSuffix: " test",
  parentUid: "0x" + "00".repeat(32),
  body: "なるほど。",
  meta: "",
};

describe("anno schema encode/decode", () => {
  it("round-trips all fields", () => {
    expect(decodeAnno(encodeAnno(fields))).toEqual(fields);
  });
  it("round-trips a non-empty meta JSON string", () => {
    const withMeta = { ...fields, meta: JSON.stringify({ motivation: "questioning" }) };
    expect(decodeAnno(encodeAnno(withMeta))).toEqual(withMeta);
  });
  it("produces a 0x hex string", () => {
    expect(encodeAnno(fields)).toMatch(/^0x[0-9a-f]+$/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anno.schema.test.ts`
Expected: FAIL — cannot resolve `../src/anno/schema`.

- [ ] **Step 3: Write the schema string**

Create `site/src/anno/constants.ts`:

```ts
/**
 * The generalized any-site comment schema (spec 2026-06-11).
 * Register once on EAS; the resulting UID is the schema version.
 */
export const ANNO_SCHEMA =
  "string url,string urlCanonical,string origin,string lang,string rootSelector,bytes32 containerHash,uint32 spanStart,uint32 spanEnd,string spanExact,string spanPrefix,string spanSuffix,bytes32 parentUid,string body,string meta";
```

- [ ] **Step 4: Write the codec**

Create `site/src/anno/schema.ts`:

```ts
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ANNO_SCHEMA } from "./constants";

export interface AnnoFields {
  url: string;
  urlCanonical: string;
  origin: string;
  lang: string;
  rootSelector: string;
  containerHash: string;
  spanStart: number;
  spanEnd: number;
  spanExact: string;
  spanPrefix: string;
  spanSuffix: string;
  parentUid: string;
  body: string;
  meta: string;
}

const encoder = () => new SchemaEncoder(ANNO_SCHEMA);

export function encodeAnno(f: AnnoFields): string {
  return encoder().encodeData([
    { name: "url", value: f.url, type: "string" },
    { name: "urlCanonical", value: f.urlCanonical, type: "string" },
    { name: "origin", value: f.origin, type: "string" },
    { name: "lang", value: f.lang, type: "string" },
    { name: "rootSelector", value: f.rootSelector, type: "string" },
    { name: "containerHash", value: f.containerHash, type: "bytes32" },
    { name: "spanStart", value: f.spanStart, type: "uint32" },
    { name: "spanEnd", value: f.spanEnd, type: "uint32" },
    { name: "spanExact", value: f.spanExact, type: "string" },
    { name: "spanPrefix", value: f.spanPrefix, type: "string" },
    { name: "spanSuffix", value: f.spanSuffix, type: "string" },
    { name: "parentUid", value: f.parentUid, type: "bytes32" },
    { name: "body", value: f.body, type: "string" },
    { name: "meta", value: f.meta, type: "string" },
  ]);
}

export function decodeAnno(data: string): AnnoFields {
  const items = encoder().decodeData(data);
  const get = (name: string) => items.find((i) => i.name === name)?.value.value;
  return {
    url: String(get("url")),
    urlCanonical: String(get("urlCanonical")),
    origin: String(get("origin")),
    lang: String(get("lang")),
    rootSelector: String(get("rootSelector")),
    containerHash: String(get("containerHash")),
    spanStart: Number(get("spanStart")),
    spanEnd: Number(get("spanEnd")),
    spanExact: String(get("spanExact")),
    spanPrefix: String(get("spanPrefix")),
    spanSuffix: String(get("spanSuffix")),
    parentUid: String(get("parentUid")),
    body: String(get("body")),
    meta: String(get("meta")),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anno.schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/anno/constants.ts src/anno/schema.ts tests/anno.schema.test.ts
git commit -m "feat(site): generalized any-site comment EAS schema codec (anno)"
```

---

## Task 2: Deterministic URL canonicalization

**Files:**
- Create: `site/src/anno/canonicalUrl.ts`
- Test: `site/tests/anno.canonicalUrl.test.ts`

- [ ] **Step 1: Write the failing test**

Create `site/tests/anno.canonicalUrl.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "../src/anno/canonicalUrl";

describe("canonicalizeUrl", () => {
  it("strips tracking params but keeps content params", () => {
    const r = canonicalizeUrl("https://Example.com/post?id=42&utm_source=tw&fbclid=xyz");
    expect(r.urlCanonical).toBe("https://example.com/post?id=42");
  });
  it("drops the fragment", () => {
    expect(canonicalizeUrl("https://example.com/a#section").urlCanonical).toBe(
      "https://example.com/a",
    );
  });
  it("removes a trailing slash on non-root paths but keeps root", () => {
    expect(canonicalizeUrl("https://example.com/a/b/").urlCanonical).toBe(
      "https://example.com/a/b",
    );
    expect(canonicalizeUrl("https://example.com/").urlCanonical).toBe("https://example.com/");
  });
  it("is order-independent (deterministic join key)", () => {
    const a = canonicalizeUrl("https://example.com/p?b=2&a=1").urlCanonical;
    const b = canonicalizeUrl("https://example.com/p?a=1&b=2").urlCanonical;
    expect(a).toBe(b);
  });
  it("drops default ports and lowercases host, exposing origin", () => {
    const r = canonicalizeUrl("https://Example.com:443/x");
    expect(r.origin).toBe("https://example.com");
    expect(r.url).toBe("https://Example.com:443/x"); // raw preserved
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anno.canonicalUrl.test.ts`
Expected: FAIL — cannot resolve `../src/anno/canonicalUrl`.

- [ ] **Step 3: Write the implementation**

Create `site/src/anno/canonicalUrl.ts`:

```ts
// Deterministic page-URL canonicalization. MUST be stable across clients:
// two authors on the same page must produce the same `urlCanonical`, or the
// per-page join key splits. Keep this function versioned and well-tested.

/** Query params dropped during canonicalization (tracking noise, denylist). */
export const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_eid",
  "mc_cid",
  "igshid",
  "ref",
  "ref_src",
];

export interface CanonicalUrl {
  /** The raw input URL, untouched (provenance / SPA fallback). */
  url: string;
  /** The canonical form used as the per-page join key. */
  urlCanonical: string;
  /** scheme://host[:port] — the site scope. */
  origin: string;
}

export function canonicalizeUrl(input: string): CanonicalUrl {
  const u = new URL(input); // host lowercased, default port dropped by URL
  for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
  u.searchParams.sort(); // stable param order
  u.hash = ""; // drop fragment (SPA hash routing handled per-site later)
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  return { url: input, urlCanonical: u.toString(), origin: u.origin };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anno.canonicalUrl.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/anno/canonicalUrl.ts tests/anno.canonicalUrl.test.ts
git commit -m "feat(site): deterministic URL canonicalization for anno"
```

---

## Task 3: Selector generation & container resolution

**Files:**
- Create: `site/src/anno/selector.ts`
- Test: `site/tests/anno.selector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `site/tests/anno.selector.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  generateSelector,
  selectorFor,
  nearestContainer,
  resolveContainer,
  findByQuote,
} from "../src/anno/selector";

function setBody(html: string): void {
  document.body.innerHTML = html;
}

describe("selector generation", () => {
  it("uses an attribute selector for an id (valid even when id starts with a digit)", () => {
    setBody('<p id="02-p7">the walkaway test</p>');
    const p = document.querySelector("p")!;
    const sel = generateSelector(p.firstChild!); // a text node inside the block
    expect(sel).toBe('[id="02-p7"]');
    expect(document.querySelector(sel!)).toBe(p);
  });

  it("builds an nth-of-type path down from the nearest id-bearing ancestor", () => {
    setBody('<article id="main"><p>one</p><p>two</p><p>three</p></article>');
    const third = document.querySelectorAll("p")[2];
    const sel = selectorFor(third);
    expect(sel).toBe('[id="main"] > p:nth-of-type(3)');
    expect(document.querySelector(sel)).toBe(third);
  });

  it("nearestContainer returns the nearest block-level ancestor", () => {
    setBody("<div><p>hello <em>there</em></p></div>");
    const em = document.querySelector("em")!;
    expect(nearestContainer(em.firstChild!)).toBe(document.querySelector("p"));
  });
});

describe("container resolution", () => {
  it("resolves via the CSS selector when it still matches", () => {
    setBody('<p id="b1">the walkaway test</p>');
    expect(resolveContainer(document, '[id="b1"]', "walkaway")).toBe(
      document.querySelector("p"),
    );
  });

  it("falls back to the smallest element containing the quote when the selector is stale", () => {
    setBody("<article><p>intro</p><p>see the walkaway test now</p></article>");
    const out = resolveContainer(document, '[id="gone"]', "walkaway test");
    expect(out).toBe(document.querySelectorAll("p")[1]);
  });

  it("findByQuote returns null when the quote is absent", () => {
    setBody("<p>nothing here</p>");
    expect(findByQuote(document, "walkaway")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anno.selector.test.ts`
Expected: FAIL — cannot resolve `../src/anno/selector`.

- [ ] **Step 3: Write the implementation**

Create `site/src/anno/selector.ts`:

```ts
import { codePoints, findOccurrences } from "../lib/anchoring";
import { normalizedBlockText } from "../web3/selection";

/** Block-level tags treated as stable comment containers. */
const BLOCK_TAGS = new Set([
  "P",
  "LI",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "ARTICLE",
  "SECTION",
  "ASIDE",
  "FIGCAPTION",
  "TD",
  "TH",
  "DD",
  "DT",
  "PRE",
]);

/** Attribute-form id selector — valid even for ids starting with a digit. */
function idSelector(id: string): string {
  return `[id="${id.replace(/(["\\])/g, "\\$1")}"]`;
}

/** 1-based :nth-of-type index of `el` among same-tag siblings. */
function nthOfType(el: Element): number {
  let n = 1;
  for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
    if (sib.tagName === el.tagName) n++;
  }
  return n;
}

/** Nearest id-bearing or block-level ancestor of a node (or the node itself). */
export function nearestContainer(node: Node): Element | null {
  let el: Element | null =
    node.nodeType === 1 ? (node as Element) : node.parentElement;
  for (; el; el = el.parentElement) {
    if (el.id) return el;
    if (BLOCK_TAGS.has(el.tagName)) return el;
  }
  return null;
}

/**
 * A CSS selector that re-selects `el`. Stops at the nearest id-bearing ancestor
 * (ids are the most stable); otherwise walks up to <body> using :nth-of-type.
 */
export function selectorFor(el: Element): string {
  if (el.id) return idSelector(el.id);
  const parts: string[] = [];
  for (let cur: Element | null = el; cur && cur.tagName !== "BODY"; cur = cur.parentElement) {
    if (cur.id) {
      parts.unshift(idSelector(cur.id));
      return parts.join(" > ");
    }
    parts.unshift(`${cur.tagName.toLowerCase()}:nth-of-type(${nthOfType(cur)})`);
  }
  parts.unshift("body");
  return parts.join(" > ");
}

/** Selector for the stable container of `node`, or null if none. */
export function generateSelector(node: Node): string | null {
  const container = nearestContainer(node);
  return container ? selectorFor(container) : null;
}

/**
 * Resolve the container element for a stored comment: try `rootSelector`, then
 * fall back to the smallest element whose normalized text contains the quote.
 */
export function resolveContainer(
  doc: Document,
  rootSelector: string,
  exact: string,
): Element | null {
  if (rootSelector) {
    try {
      const hit = doc.querySelector(rootSelector);
      if (hit) return hit;
    } catch {
      // invalid/stale selector — fall through to the text search
    }
  }
  return findByQuote(doc, exact);
}

/** Smallest element in the document whose normalized text contains `exact`. */
export function findByQuote(doc: Document, exact: string): Element | null {
  const needle = codePoints(exact);
  if (needle.length === 0 || !doc.body) return null;
  let best: Element | null = null;
  let bestLen = Infinity;
  for (const el of Array.from(doc.body.querySelectorAll<Element>("*"))) {
    const text = normalizedBlockText(el);
    if (text.length < bestLen && findOccurrences(codePoints(text), needle).length > 0) {
      best = el;
      bestLen = text.length;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anno.selector.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/anno/selector.ts tests/anno.selector.test.ts
git commit -m "feat(site): CSS selector generation + container resolution for anno"
```

---

## Task 4: Author-time field builder

**Files:**
- Create: `site/src/anno/author.ts`
- Test: `site/tests/anno.author.test.ts`

- [ ] **Step 1: Write the failing test**

Create `site/tests/anno.author.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { buildAnnoFields } from "../src/anno/author";

function selectQuote(el: Element, quote: string): Range {
  const text = el.firstChild as Text;
  const idx = (el.textContent ?? "").indexOf(quote);
  const range = document.createRange();
  range.setStart(text, idx);
  range.setEnd(text, idx + quote.length);
  return range;
}

describe("buildAnnoFields", () => {
  it("assembles a full AnnoFields from a selection", () => {
    document.body.innerHTML = '<p id="b1">the walkaway test</p>';
    const p = document.querySelector("p")!;
    const fields = buildAnnoFields({
      href: "https://example.com/x?utm_source=t",
      lang: "en",
      range: selectQuote(p, "walkaway"),
      body: "nice",
    })!;
    expect(fields).not.toBeNull();
    expect(fields.rootSelector).toBe('[id="b1"]');
    expect(fields.urlCanonical).toBe("https://example.com/x");
    expect(fields.origin).toBe("https://example.com");
    expect(fields.spanExact).toBe("walkaway");
    expect(fields.spanStart).toBe(4);
    expect(fields.spanEnd).toBe(12);
    expect(fields.containerHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(fields.parentUid).toBe("0x" + "00".repeat(32));
    expect(fields.meta).toBe("");
  });

  it("returns null when the selection is not inside a container", () => {
    document.body.innerHTML = "<p>hello</p>";
    const range = document.createRange();
    range.selectNodeContents(document.body); // spans, not a single block
    range.collapse(true); // collapsed → no offsets
    expect(buildAnnoFields({ href: "https://e.com/", lang: "en", range, body: "x" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anno.author.test.ts`
Expected: FAIL — cannot resolve `../src/anno/author`.

- [ ] **Step 3: Write the implementation**

Create `site/src/anno/author.ts`:

```ts
import { anchorFromSelection } from "../web3/selection";
import { nearestContainer, selectorFor } from "./selector";
import { canonicalizeUrl } from "./canonicalUrl";
import type { AnnoFields } from "./schema";

const ZERO_UID = "0x" + "00".repeat(32);

export interface DraftInput {
  /** The page URL at authoring time (e.g. location.href). */
  href: string;
  /** The page language (e.g. document.documentElement.lang). */
  lang: string;
  /** The user's text selection. */
  range: Range;
  /** The comment body. */
  body: string;
  /** Parent attestation UID for a reply (default: zero = top-level). */
  parentUid?: string;
  /** JSON escape-hatch (default: ""). */
  meta?: string;
}

/**
 * Build a complete `AnnoFields` from a selection: resolve the stable container,
 * generate its selector, anchor the quote within it, and canonicalize the URL.
 * Returns null when the selection has no usable container/anchor.
 */
export function buildAnnoFields(input: DraftInput): AnnoFields | null {
  const container = nearestContainer(input.range.commonAncestorContainer);
  if (container === null) return null;
  const anchor = anchorFromSelection(container, input.range);
  if (anchor === null) return null;
  const { url, urlCanonical, origin } = canonicalizeUrl(input.href);
  return {
    url,
    urlCanonical,
    origin,
    lang: input.lang,
    rootSelector: selectorFor(container),
    containerHash: anchor.blockHash,
    spanStart: anchor.start,
    spanEnd: anchor.end,
    spanExact: anchor.exact,
    spanPrefix: anchor.prefix,
    spanSuffix: anchor.suffix,
    parentUid: input.parentUid ?? ZERO_UID,
    body: input.body,
    meta: input.meta ?? "",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anno.author.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/anno/author.ts tests/anno.author.test.ts
git commit -m "feat(site): author-time AnnoFields builder (selection -> fields)"
```

---

## Task 5: Read-time projection (`locate`)

**Files:**
- Create: `site/src/anno/locate.ts`
- Test: `site/tests/anno.locate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `site/tests/anno.locate.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { locate, type StoredAnno } from "../src/anno/locate";
import { normalizedBlockText } from "../src/web3/selection";
import { blockHashFromNormalized } from "../src/lib/hash";

function stored(over: Partial<StoredAnno>): StoredAnno {
  return {
    uid: "0x1",
    attester: "0xa",
    time: 0,
    url: "https://example.com/x",
    urlCanonical: "https://example.com/x",
    origin: "https://example.com",
    lang: "en",
    rootSelector: '[id="b1"]',
    containerHash: "0x" + "00".repeat(32),
    spanStart: 4,
    spanEnd: 12,
    spanExact: "walkaway",
    spanPrefix: "the ",
    spanSuffix: " test",
    parentUid: "0x" + "00".repeat(32),
    body: "x",
    meta: "",
    ...over,
  };
}

describe("locate", () => {
  it("marks a comment anchored when the container hash matches the live text", () => {
    document.body.innerHTML = '<p id="b1">the walkaway test</p>';
    const text = normalizedBlockText(document.querySelector("p")!);
    const out = locate(document, stored({ containerHash: blockHashFromNormalized(text) }));
    expect(out.projection.status).toBe("anchored");
    expect(out.projection.start).toBe(4);
  });

  it("re-anchors when the container changed but the quote still exists", () => {
    document.body.innerHTML = '<p id="b1">see the walkaway test now</p>';
    const out = locate(document, stored({ containerHash: "0x" + "ab".repeat(32) }));
    expect(out.projection.status).toBe("re-anchored");
    expect(out.projection.pastVersion).toBe(true);
  });

  it("re-anchors via the fallback when the selector is stale but the quote exists elsewhere", () => {
    document.body.innerHTML = "<article><p>intro</p><p>the walkaway test</p></article>";
    const out = locate(document, stored({ rootSelector: '[id="gone"]', containerHash: "0x" + "ab".repeat(32) }));
    expect(out.projection.status).toBe("re-anchored");
  });

  it("marks orphaned when the quote is nowhere on the page", () => {
    document.body.innerHTML = "<p>unrelated content</p>";
    const out = locate(document, stored({ rootSelector: '[id="gone"]' }));
    expect(out.projection.status).toBe("orphaned");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anno.locate.test.ts`
Expected: FAIL — cannot resolve `../src/anno/locate`.

- [ ] **Step 3: Write the implementation**

Create `site/src/anno/locate.ts`:

```ts
import { project, type Anchor, type Projection } from "../lib/anchoring";
import { blockHashFromNormalized } from "../lib/hash";
import { normalizedBlockText } from "../web3/selection";
import { resolveContainer } from "./selector";
import type { AnnoFields } from "./schema";

/** A stored generalized comment = AnnoFields + EAS attestation envelope. */
export interface StoredAnno extends AnnoFields {
  uid: string;
  attester: string;
  time: number; // unix seconds
}

export interface LocatedAnno {
  comment: StoredAnno;
  projection: Projection;
}

/** View a stored comment's anchor fields as an `Anchor` (containerHash = blockHash). */
function toAnchor(c: AnnoFields): Anchor {
  return {
    blockHash: c.containerHash as `0x${string}`,
    exact: c.spanExact,
    prefix: c.spanPrefix,
    suffix: c.spanSuffix,
    start: c.spanStart,
    end: c.spanEnd,
  };
}

/**
 * Locate one stored comment within `doc` and project its span onto the live
 * container. Resolves the container via `rootSelector` (with quote fallback),
 * then reuses the pure `project()` re-anchoring logic.
 */
export function locate(doc: Document, c: StoredAnno): LocatedAnno {
  const container = resolveContainer(doc, c.rootSelector, c.spanExact);
  if (container === null) {
    return { comment: c, projection: project(toAnchor(c), null) };
  }
  const text = normalizedBlockText(container);
  const current = { blockHash: blockHashFromNormalized(text), text };
  return { comment: c, projection: project(toAnchor(c), current) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anno.locate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/anno/locate.ts tests/anno.locate.test.ts
git commit -m "feat(site): read-time projection (locate) for anno comments"
```

---

## Task 6: Schema registration script + full verification

**Files:**
- Create: `site/scripts/register-anno-schema.ts`
- Modify: `site/package.json`

- [ ] **Step 1: Write the registration script**

Create `site/scripts/register-anno-schema.ts` (mirrors `scripts/register-schema.ts`, swaps the schema constant):

```ts
import { JsonRpcProvider, Wallet } from "ethers";
import type { SchemaRegistry as SchemaRegistryType } from "@ethereum-attestation-service/eas-sdk";
import easSdk from "@ethereum-attestation-service/eas-sdk";
const { SchemaRegistry } = easSdk as unknown as {
  SchemaRegistry: typeof SchemaRegistryType;
};
import { SCHEMA_REGISTRY_ADDRESS } from "../src/web3/constants";
import { ANNO_SCHEMA } from "../src/anno/constants";

const pk = process.env.SEPOLIA_PRIVATE_KEY;
const rpc = process.env.PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
if (!pk) throw new Error("set SEPOLIA_PRIVATE_KEY (a funded Sepolia testnet key)");

const signer = new Wallet(pk, new JsonRpcProvider(rpc));
const registry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
registry.connect(signer);

console.log("registering anno schema on Sepolia…");
console.log(ANNO_SCHEMA);
const tx = await registry.register({
  schema: ANNO_SCHEMA,
  resolverAddress: "0x".padEnd(42, "0"),
  revocable: true,
});
const uid = await tx.wait();
console.log(`\nanno schema UID: ${uid}`);
console.log("→ set PUBLIC_EAS_ANNO_SCHEMA_UID in site/.env to this value");
```

- [ ] **Step 2: Add the package.json script**

In `site/package.json`, in the `scripts` block, add the `anno:schema:register` line right after the existing `schema:register` line (line 21):

```json
    "schema:register": "tsx scripts/register-schema.ts",
    "anno:schema:register": "tsx scripts/register-anno-schema.ts",
```

- [ ] **Step 3: Verify the script typechecks (do NOT run it — it sends a real tx)**

Run: `pnpm typecheck`
Expected: PASS, no errors. (Registration itself is a manual, funded, one-off step the maintainer runs when ready; it is intentionally not part of the test suite.)

- [ ] **Step 4: Run the whole suite + lint + format check**

Run: `pnpm test`
Expected: PASS — all existing tests plus the 5 new `anno.*` test files (20 new assertions) green.

Run: `pnpm lint`
Expected: no errors from `src/anno` or `tests/anno.*`.

Run: `pnpm fmt:check`
Expected: clean. If it reports diffs, run `pnpm fmt` and re-run `pnpm fmt:check`.

- [ ] **Step 5: Commit**

```bash
git add scripts/register-anno-schema.ts package.json
git commit -m "feat(site): anno schema registration script (anno:schema:register)"
```

---

## Done / Hand-off to Plan 2

After Task 6, `site/src/anno/` is a complete, tested, extension-agnostic layer:
- `buildAnnoFields()` turns a DOM selection into encodable fields (author side).
- `encodeAnno()` / `decodeAnno()` serialize to/from EAS attestation data.
- `locate()` projects a stored comment back onto any live page (read side), reusing the proven `project()` re-anchoring.

**The maintainer runs `pnpm anno:schema:register` once** (funded Sepolia key) and records `PUBLIC_EAS_ANNO_SCHEMA_UID`. Plan 2 (Chrome extension) consumes this layer: content script wires `window.getSelection()` → `buildAnnoFields` → `encodeAnno` → EAS attest, and `fetch(decodeAnno)` → `locate` → render markers.

---

## Self-Review

**Spec coverage:**
- Schema string + 14 fields (spec §3) → Task 1 (`constants.ts`, `schema.ts`). ✓
- `url`/`urlCanonical`/`origin` + deterministic canonicalization, denylist tracking params, fragment/trailing-slash rules (spec §3, §8.1) → Task 2. ✓
- `rootSelector` CSS generation + container resolution + whole-doc TextQuote fallback (spec §3 #5, §5, §6) → Task 3. ✓
- `containerHash` = keccak of normalized container text; reuse of `project()` two-tier logic unchanged (spec §6 #6, §5, §8.2) → Task 5 (`locate`), reusing `lib/anchoring.ts` + `lib/hash.ts`. ✓
- `meta` escape-hatch as a round-trippable JSON string, default `""` (spec §3 #14, §7) → Task 1 codec + author default. ✓
- Author flow ties selector-gen + anchor + canonical URL together (spec §6 #1) → Task 4. ✓
- EAS envelope fields (uid/attester/time) kept out of schema, present on `StoredAnno` (spec §3 note) → Task 5. ✓
- Deferred per spec §9 (multi-target, off-chain body, reactions, explicit version field) → not implemented, documented in Scope note. ✓
- Registration (spec decision Q1 on-chain, immutable UID = version) → Task 6 script; the maintainer runs it. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Every code step shows full file contents or the exact edited lines. ✓

**Type consistency:** `AnnoFields` (Task 1) is extended by `StoredAnno` (Task 5) and produced by `buildAnnoFields` (Task 4); field names/types identical across all three. `containerHash: string` in fields ↔ cast to `0x${string}` only inside `toAnchor`. `resolveContainer(doc, rootSelector, exact)` signature identical in Task 3 definition and Task 5 call. `normalizedBlockText` / `blockHashFromNormalized` / `anchorFromSelection` / `project` / `codePoints` / `findOccurrences` all reference verified existing exports. ✓
