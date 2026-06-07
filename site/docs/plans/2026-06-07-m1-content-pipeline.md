# M1 — Content Pipeline & blockId Markers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the content pipeline for the commentary site: auto-managed inline `<!-- block: NN-pM -->` markers, a deterministic block parser + normalization + hashing, cross-language parity/uniqueness checks (CI), and `anchors.json` emission.

**Architecture:** A small TypeScript package under `site/`. Pure, framework-free modules in `site/src/lib/` (normalize, hash, ids, blocks, sources, inject, check, anchors) are the single source of truth for normalization + hashing so the browser re-anchoring layer (M3) reuses them verbatim. Thin CLIs in `site/scripts/` wire those modules to the filesystem. English is the id authority; translations mirror EN block ids by position. Normalization is deterministic (NFC, `\n` line endings, trailing-whitespace trim) and `blockHash = keccak256(utf8(normalizedText))`.

**Tech Stack:** Node + TypeScript (ESM), `tsx` (run TS CLIs), `vitest` (tests), `viem` (`keccak256`/`toBytes`). No chain access in M1.

---

## Context for the implementer

- The repo root holds the translation sources: `source/en/chapters/*.md` (English authority) and `source/ja/chapters/*.md` (Japanese). Chapters are matched by a two-digit filename prefix (`02-ourrole.md` ↔ `02-財団の役割.md`) and are paragraph-aligned.
- All work in this plan happens inside `site/` (run pnpm scripts from there). The CLIs read sources via paths in `site/config.json` (relative to that file).
- This branch is `feat/commentary` on the fork. Task 8 **edits the real `source/**/*.md` files** to inject markers — that is intended by the design (markers are invisible in every Markdown renderer and stripped from build output).
- A "block" = a run of non-empty lines delimited by blank lines (a paragraph or heading). Block text may contain a single internal `\n` (some paragraphs wrap mid-line in the source); that is preserved.
- Module imports are extensionless (TS `moduleResolution: Bundler` + `tsx`/`vitest`).

## File Structure

Created under `site/`:
- `package.json`, `tsconfig.json`, `.gitignore`, `pnpm-lock.yaml`
- `config.json` — source manifest (en, ja)
- `src/lib/normalize.ts` — canonicalize block text + code-point length
- `src/lib/hash.ts` — `blockHash` via viem keccak256
- `src/lib/ids.ts` — parse/format/next `NN-pM`
- `src/lib/blocks.ts` — `parseChapter`, `Block`, marker regex
- `src/lib/sources.ts` — load config, list chapters, `sourceIdHash`
- `src/lib/inject.ts` — assign EN ids / align translation ids / render
- `src/lib/check.ts` — missing/duplicate id + parity issue detection
- `src/lib/anchors.ts` — build per-chapter anchors
- `scripts/inject-markers.ts`, `scripts/check-markers.ts`, `scripts/build-anchors.ts`
- `tests/*.test.ts` — one per lib module
- `anchors/` — generated output (gitignored)

Modified:
- `scripts/build.py` (repo root) — strip markers from merged output
- `site/README.md` — add a Pipeline section
- `.github/workflows/site-checks.yml` (repo root) — CI

---

## Task 1: Scaffold the `site/` TypeScript package

**Files:**
- Create: `site/package.json`
- Create: `site/tsconfig.json`
- Create: `site/.gitignore`
- Create: `site/tests/smoke.test.ts`

- [ ] **Step 1: Create `site/package.json`**

```json
{
  "name": "ef-mandate-site",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.30.3",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "blocks:inject": "tsx scripts/inject-markers.ts",
    "blocks:check": "tsx scripts/check-markers.ts",
    "anchors:build": "tsx scripts/build-anchors.ts"
  },
  "dependencies": {
    "viem": "^2.21.0"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `site/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "lib": ["ES2022", "DOM"],
    "noEmit": true
  },
  "include": ["src", "scripts", "tests"]
}
```

- [ ] **Step 3: Create `site/.gitignore`**

```gitignore
node_modules/
dist/
anchors/
.astro/
```

- [ ] **Step 4: Create `site/tests/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Install dependencies**

Run (from `site/`): `pnpm install`
Expected: creates `node_modules/` and `pnpm-lock.yaml`, no errors.

- [ ] **Step 6: Run the smoke test**

Run (from `site/`): `pnpm test`
Expected: PASS, 1 test passed.

- [ ] **Step 7: Commit**

```bash
git add site/package.json site/tsconfig.json site/.gitignore site/pnpm-lock.yaml site/tests/smoke.test.ts
git commit -m "chore(site): scaffold TypeScript pipeline package"
```

---

## Task 2: Normalization module

**Files:**
- Create: `site/src/lib/normalize.ts`
- Test: `site/tests/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { normalizeBlockText, stripMarker, codePointLength } from "../src/lib/normalize";

describe("normalizeBlockText", () => {
  it("strips a leading block marker line", () => {
    expect(normalizeBlockText("<!-- block: 02-p1 -->\nHello")).toBe("Hello");
  });
  it("normalizes CRLF to LF", () => {
    expect(normalizeBlockText("a\r\nb")).toBe("a\nb");
  });
  it("trims trailing whitespace per line and block ends", () => {
    expect(normalizeBlockText("  a  \n  b  \n")).toBe("a\n  b"); // first line's leading ws trimmed by trim(); interior leading ws kept
  });
  it("applies Unicode NFC", () => {
    expect(normalizeBlockText("é")).toBe("é");
  });
  it("counts code points (not UTF-16 units)", () => {
    expect(codePointLength("a\u{1F600}b")).toBe(3);
  });
  it("stripMarker leaves marker-less text untouched", () => {
    expect(stripMarker("no marker here")).toBe("no marker here");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/normalize.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/normalize").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/normalize.ts
// Deterministic canonicalization of a block's text, shared by build + browser.

const MARKER_LINE_RE = /^<!--\s*block:\s*[^>]*-->\s*$/;

/** Remove a leading `<!-- block: ... -->` line if present. */
export function stripMarker(blockSource: string): string {
  const lines = blockSource.split("\n");
  if (lines.length > 0 && MARKER_LINE_RE.test(lines[0])) {
    lines.shift();
  }
  return lines.join("\n");
}

/** Canonical text used for hashing and span offsets. */
export function normalizeBlockText(blockSource: string): string {
  let text = stripMarker(blockSource);
  text = text.replace(/\r\n?/g, "\n"); // line endings -> \n
  text = text.normalize("NFC"); // Unicode NFC
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "")) // trailing whitespace per line
    .join("\n");
  return text.trim(); // trim block ends
}

/** Length in Unicode code points (offsets are code-point based). */
export function codePointLength(text: string): number {
  return [...text].length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/normalize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/normalize.ts site/tests/normalize.test.ts
git commit -m "feat(site): deterministic block text normalization"
```

---

## Task 3: Hash module

**Files:**
- Create: `site/src/lib/hash.ts`
- Test: `site/tests/hash.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { blockHash, blockHashFromNormalized } from "../src/lib/hash";

const EMPTY_KECCAK =
  "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";

describe("blockHash", () => {
  it("matches the known keccak256 of empty input", () => {
    expect(blockHashFromNormalized("")).toBe(EMPTY_KECCAK);
  });
  it("is invariant to marker, CRLF, and trailing whitespace", () => {
    const a = blockHash("<!-- block: 01-p1 -->\nhello world");
    const b = blockHash("hello world\r\n");
    expect(a).toBe(b);
  });
  it("differs for different text", () => {
    expect(blockHash("alpha")).not.toBe(blockHash("beta"));
  });
  it("returns a 0x-prefixed 32-byte hex string", () => {
    expect(blockHash("x")).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/hash.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/hash").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/hash.ts
import { keccak256, stringToBytes } from "viem";
import { normalizeBlockText } from "./normalize";

/** keccak256 of the UTF-8 bytes of already-normalized text. */
export function blockHashFromNormalized(normalized: string): `0x${string}` {
  return keccak256(stringToBytes(normalized));
}

/** Normalize raw block source, then hash. */
export function blockHash(blockSource: string): `0x${string}` {
  return blockHashFromNormalized(normalizeBlockText(blockSource));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/hash.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/hash.ts site/tests/hash.test.ts
git commit -m "feat(site): keccak256 block hashing over normalized text"
```

---

## Task 4: blockId helpers

**Files:**
- Create: `site/src/lib/ids.ts`
- Test: `site/tests/ids.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatId, parseIdNumber, nextIdNumber } from "../src/lib/ids";

describe("ids", () => {
  it("formats NN-pM", () => {
    expect(formatId("02", 7)).toBe("02-p7");
  });
  it("parses the numeric suffix", () => {
    expect(parseIdNumber("02-p7")).toBe(7);
    expect(parseIdNumber("garbage")).toBeNull();
  });
  it("nextIdNumber is 1 for an empty set", () => {
    expect(nextIdNumber([])).toBe(1);
  });
  it("nextIdNumber is max+1 and ignores gaps/invalid ids", () => {
    expect(nextIdNumber(["02-p1", "02-p3", "bad"])).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/ids.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/ids").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/ids.ts
export const ID_RE = /^(\d{2})-p(\d+)$/;

export function formatId(chapter: string, n: number): string {
  return `${chapter}-p${n}`;
}

export function parseIdNumber(id: string): number | null {
  const m = ID_RE.exec(id);
  return m ? parseInt(m[2], 10) : null;
}

/** Smallest unused number = max existing + 1 (stable; never renumbers). */
export function nextIdNumber(existing: string[]): number {
  let max = 0;
  for (const id of existing) {
    const n = parseIdNumber(id);
    if (n !== null && n > max) max = n;
  }
  return max + 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/ids.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/ids.ts site/tests/ids.test.ts
git commit -m "feat(site): blockId format/parse/next helpers"
```

---

## Task 5: Block parser

**Files:**
- Create: `site/src/lib/blocks.ts`
- Test: `site/tests/blocks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseChapter } from "../src/lib/blocks";

describe("parseChapter", () => {
  it("splits on blank lines into blocks", () => {
    const blocks = parseChapter("# Heading\n\nFirst para.\n\nSecond para.");
    expect(blocks.map((b) => b.content)).toEqual([
      "# Heading",
      "First para.",
      "Second para.",
    ]);
  });
  it("captures an existing marker id and excludes it from content", () => {
    const blocks = parseChapter("<!-- block: 02-p1 -->\n# Heading\n\nBody");
    expect(blocks[0].id).toBe("02-p1");
    expect(blocks[0].content).toBe("# Heading");
    expect(blocks[1].id).toBeNull();
  });
  it("keeps a single internal newline inside one block", () => {
    const blocks = parseChapter("line one\nline two\n\nnext");
    expect(blocks[0].content).toBe("line one\nline two");
    expect(blocks).toHaveLength(2);
  });
  it("ignores blank-only lines between blocks (incl. CRLF)", () => {
    const blocks = parseChapter("a\r\n\r\nb");
    expect(blocks.map((b) => b.content)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/blocks.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/blocks").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/blocks.ts

/** A block marker line, capturing the id (e.g. `02-p7`). */
export const MARKER_RE = /^<!--\s*block:\s*([^\s>]+)\s*-->\s*$/;

export interface Block {
  /** Stable id, or null if the block has no marker yet. */
  id: string | null;
  /** The raw marker line if present, else null. */
  marker: string | null;
  /** Block content WITHOUT the marker line (raw, pre-normalize). */
  content: string;
}

/** Parse a chapter's Markdown into blocks (blank-line delimited). */
export function parseChapter(source: string): Block[] {
  const lf = source.replace(/\r\n?/g, "\n");
  const segments = lf
    .split(/\n[ \t]*\n+/) // one or more blank lines
    .map((s) => s.replace(/^\n+|\n+$/g, ""))
    .filter((s) => s.trim().length > 0);

  return segments.map((seg) => {
    const lines = seg.split("\n");
    const m = MARKER_RE.exec(lines[0]);
    if (m) {
      return { id: m[1], marker: lines[0], content: lines.slice(1).join("\n") };
    }
    return { id: null, marker: null, content: seg };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/blocks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/blocks.ts site/tests/blocks.test.ts
git commit -m "feat(site): blank-line block parser with marker capture"
```

---

## Task 6: Config + chapter listing

**Files:**
- Create: `site/src/lib/sources.ts`
- Create: `site/config.json`
- Test: `site/tests/sources.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { sourceIdHash, chapterNumberFromFilename } from "../src/lib/sources";

describe("sources", () => {
  it("chapterNumberFromFilename reads the two-digit prefix", () => {
    expect(chapterNumberFromFilename("02-ourrole.md")).toBe("02");
    expect(chapterNumberFromFilename("02-財団の役割.md")).toBe("02");
    expect(chapterNumberFromFilename(".DS_Store")).toBeNull();
    expect(chapterNumberFromFilename("readme.md")).toBeNull();
  });
  it("sourceIdHash is a deterministic 0x 32-byte hex", () => {
    const a = sourceIdHash("ethereumjp/ef-mandate-localize-jp@ja");
    const b = sourceIdHash("ethereumjp/ef-mandate-localize-jp@ja");
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).not.toBe(sourceIdHash("other@en"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/sources.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/sources").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/sources.ts
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { keccak256, stringToBytes } from "viem";

export interface SourceConfig {
  lang: string;
  /** Human identifier, e.g. "ethereumjp/ef-mandate-localize-jp@ja". */
  sourceId: string;
  /** Path to the chapters directory, relative to config.json. */
  path: string;
}

export interface Config {
  sources: SourceConfig[];
}

export function loadConfig(configPath: string): { config: Config; baseDir: string } {
  const abs = resolve(configPath);
  const config = JSON.parse(readFileSync(abs, "utf8")) as Config;
  return { config, baseDir: dirname(abs) };
}

export function chaptersDir(baseDir: string, src: SourceConfig): string {
  return resolve(baseDir, src.path);
}

/** On-chain sourceId = keccak256(identifier). */
export function sourceIdHash(identifier: string): `0x${string}` {
  return keccak256(stringToBytes(identifier));
}

export function chapterNumberFromFilename(name: string): string | null {
  if (!name.endsWith(".md") || name.startsWith(".")) return null;
  const num = name.slice(0, 2);
  return /^\d{2}$/.test(num) ? num : null;
}

/** Map of chapterNumber -> absolute file path, sorted by chapter number. */
export function listChapters(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of readdirSync(dir).sort()) {
    const num = chapterNumberFromFilename(name);
    if (num) map.set(num, resolve(dir, name));
  }
  return map;
}
```

- [ ] **Step 4: Create `site/config.json`**

```json
{
  "sources": [
    {
      "lang": "en",
      "sourceId": "ethereumjp/ef-mandate-localize-jp@en",
      "path": "../source/en/chapters"
    },
    {
      "lang": "ja",
      "sourceId": "ethereumjp/ef-mandate-localize-jp@ja",
      "path": "../source/ja/chapters"
    }
  ]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/sources.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add site/src/lib/sources.ts site/config.json site/tests/sources.test.ts
git commit -m "feat(site): config loader, chapter listing, sourceId hash"
```

---

## Task 7: Marker injection (pure)

**Files:**
- Create: `site/src/lib/inject.ts`
- Test: `site/tests/inject.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { assignEnIds, alignTranslationIds, renderChapter } from "../src/lib/inject";
import { parseChapter } from "../src/lib/blocks";

describe("assignEnIds", () => {
  it("assigns p1.. in order to unmarked blocks", () => {
    const blocks = assignEnIds(parseChapter("A\n\nB\n\nC"), "02");
    expect(blocks.map((b) => b.id)).toEqual(["02-p1", "02-p2", "02-p3"]);
  });
  it("preserves existing ids and gives new blocks max+1", () => {
    const src = "<!-- block: 02-p1 -->\nA\n\nB\n\n<!-- block: 02-p5 -->\nC";
    const blocks = assignEnIds(parseChapter(src), "02");
    expect(blocks.map((b) => b.id)).toEqual(["02-p1", "02-p6", "02-p5"]);
  });
});

describe("alignTranslationIds", () => {
  it("copies EN ids by position", () => {
    const blocks = alignTranslationIds(parseChapter("X\n\nY"), ["02-p1", "02-p2"], "02");
    expect(blocks.map((b) => b.id)).toEqual(["02-p1", "02-p2"]);
  });
  it("throws when block counts differ", () => {
    expect(() => alignTranslationIds(parseChapter("X"), ["02-p1", "02-p2"], "02")).toThrow(
      /1 blocks but EN has 2/
    );
  });
});

describe("renderChapter", () => {
  it("writes a marker line above each block, one blank line between", () => {
    const blocks = assignEnIds(parseChapter("A\n\nB"), "02");
    expect(renderChapter(blocks)).toBe(
      "<!-- block: 02-p1 -->\nA\n\n<!-- block: 02-p2 -->\nB\n"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/inject.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/inject").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/inject.ts
import { Block } from "./blocks";
import { formatId, nextIdNumber } from "./ids";

function withMarker(id: string, content: string): Block {
  return { id, marker: `<!-- block: ${id} -->`, content };
}

/** EN is the authority: keep existing ids, assign new ones as max+1. */
export function assignEnIds(blocks: Block[], chapter: string): Block[] {
  const existing = blocks.map((b) => b.id).filter((x): x is string => x !== null);
  let counter = nextIdNumber(existing);
  return blocks.map((b) =>
    withMarker(b.id ?? formatId(chapter, counter++), b.content)
  );
}

/** Translations mirror EN ids by position. */
export function alignTranslationIds(
  blocks: Block[],
  enIds: string[],
  chapter: string
): Block[] {
  if (blocks.length !== enIds.length) {
    throw new Error(
      `chapter ${chapter}: translation has ${blocks.length} blocks but EN has ${enIds.length}; ` +
        `block counts must match to align markers`
    );
  }
  return blocks.map((b, i) => withMarker(enIds[i], b.content));
}

/** Serialize blocks back to Markdown (marker line + content, blank-separated). */
export function renderChapter(blocks: Block[]): string {
  return blocks.map((b) => `${b.marker}\n${b.content}`).join("\n\n") + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/inject.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add site/src/lib/inject.ts site/tests/inject.test.ts
git commit -m "feat(site): pure marker injection (EN authority, aligned translations)"
```

---

## Task 8: Inject CLI + apply markers to the real sources

**Files:**
- Create: `site/scripts/inject-markers.ts`
- Modify: `source/en/chapters/*.md`, `source/ja/chapters/*.md` (generated by running the CLI)

- [ ] **Step 1: Write the CLI**

```ts
// site/scripts/inject-markers.ts
import { readFileSync, writeFileSync } from "node:fs";
import { loadConfig, listChapters, chaptersDir } from "../src/lib/sources";
import { parseChapter } from "../src/lib/blocks";
import { assignEnIds, alignTranslationIds, renderChapter } from "../src/lib/inject";

const configPath = process.argv[2] ?? "config.json";
const { config, baseDir } = loadConfig(configPath);

const en = config.sources.find((s) => s.lang === "en");
if (!en) throw new Error("config must include an 'en' source (the id authority)");

// 1. English first (the id authority).
const enIdsByChapter = new Map<string, string[]>();
for (const [chapter, file] of listChapters(chaptersDir(baseDir, en))) {
  const blocks = assignEnIds(parseChapter(readFileSync(file, "utf8")), chapter);
  writeFileSync(file, renderChapter(blocks));
  enIdsByChapter.set(chapter, blocks.map((b) => b.id as string));
  console.log(`en ${chapter}: ${blocks.length} blocks`);
}

// 2. Translations aligned to EN by position.
for (const src of config.sources.filter((s) => s.lang !== "en")) {
  for (const [chapter, file] of listChapters(chaptersDir(baseDir, src))) {
    const enIds = enIdsByChapter.get(chapter);
    if (!enIds) throw new Error(`${src.lang} ${chapter}: no matching EN chapter`);
    const blocks = alignTranslationIds(parseChapter(readFileSync(file, "utf8")), enIds, chapter);
    writeFileSync(file, renderChapter(blocks));
    console.log(`${src.lang} ${chapter}: ${blocks.length} blocks`);
  }
}
console.log("done");
```

- [ ] **Step 2: Run the injector on the real sources**

Run (from `site/`): `pnpm run blocks:inject`
Expected: prints `en 01..08` and `ja 01..08` with block counts and `done`.

If it throws `translation has N blocks but EN has M` for a chapter: the Japanese chapter's paragraph/heading structure diverges from English. Fix by splitting/merging the offending Japanese block(s) so the block count matches EN (the chapters are meant to be paragraph-aligned), then re-run. Do not change ids by hand.

- [ ] **Step 3: Verify markers landed and rendering is unaffected**

Run (from repo root): `git diff --stat source/`
Expected: every `source/en/chapters/*.md` and `source/ja/chapters/*.md` shows insertions (the marker lines).

Run: `grep -c "<!-- block:" "source/ja/chapters/02-財団の役割.md"`
Expected: a positive count equal to that chapter's block count.

- [ ] **Step 4: Confirm idempotency**

Run (from `site/`): `pnpm run blocks:inject` again, then (repo root) `git diff --stat source/`
Expected: **no further changes** beyond Step 2 (re-running injects nothing new).

- [ ] **Step 5: Commit**

```bash
git add site/scripts/inject-markers.ts source/en/chapters source/ja/chapters
git commit -m "feat(site): inject blockId markers into en/ja sources"
```

---

## Task 9: Strip markers from the existing Python build output

**Files:**
- Modify: `scripts/build.py` (repo root)

- [ ] **Step 1: Add a marker-stripping regex and apply it on read**

In `scripts/build.py`, add `import re` near the top imports, then change `read_chapters` so each chapter's text has marker lines removed.

Find:

```python
def read_chapters(chapter_paths: list[Path]) -> list[Chapter]:
    chapters: list[Chapter] = []
    for path in chapter_paths:
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            raise ValueError(f"Chapter is empty: {path}")
        chapters.append(Chapter(path=path, text=text))
    return chapters
```

Replace with:

```python
BLOCK_MARKER_RE = re.compile(r"^[ \t]*<!--\s*block:[^>]*-->[ \t]*\n?", re.MULTILINE)


def read_chapters(chapter_paths: list[Path]) -> list[Chapter]:
    chapters: list[Chapter] = []
    for path in chapter_paths:
        raw = path.read_text(encoding="utf-8")
        text = BLOCK_MARKER_RE.sub("", raw).strip()
        if not text:
            raise ValueError(f"Chapter is empty: {path}")
        chapters.append(Chapter(path=path, text=text))
    return chapters
```

(Ensure `import re` is present in the import block at the top of the file.)

- [ ] **Step 2: Build the merged markdown and verify markers are gone**

Run (from repo root): `python3 scripts/build.py --no-pdf`
Expected: prints `Wrote .../dist/ef-mandate-ja.md`.

Run: `grep -c "<!-- block:" dist/ef-mandate-ja.md`
Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add scripts/build.py
git commit -m "build: strip blockId markers from merged manuscript"
```

---

## Task 10: Cross-language check + CLI

**Files:**
- Create: `site/src/lib/check.ts`
- Create: `site/scripts/check-markers.ts`
- Test: `site/tests/check.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { missingOrDuplicateIds, parityIssues } from "../src/lib/check";
import { parseChapter } from "../src/lib/blocks";

describe("missingOrDuplicateIds", () => {
  it("flags a block without a marker", () => {
    const issues = missingOrDuplicateIds(parseChapter("A"), "en", "02");
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("missing-marker");
  });
  it("flags duplicate ids", () => {
    const src = "<!-- block: 02-p1 -->\nA\n\n<!-- block: 02-p1 -->\nB";
    const issues = missingOrDuplicateIds(parseChapter(src), "en", "02");
    expect(issues.map((i) => i.kind)).toEqual(["duplicate-id"]);
  });
  it("passes a clean chapter", () => {
    const src = "<!-- block: 02-p1 -->\nA\n\n<!-- block: 02-p2 -->\nB";
    expect(missingOrDuplicateIds(parseChapter(src), "en", "02")).toEqual([]);
  });
});

describe("parityIssues", () => {
  it("reports ids missing in / extra in the translation", () => {
    const issues = parityIssues(["02-p1", "02-p2"], ["02-p1", "02-p9"], "ja", "02");
    expect(issues.map((i) => `${i.kind}:${i.detail}`).sort()).toEqual([
      "extra-in-translation:02-p9",
      "missing-in-translation:02-p2",
    ]);
  });
  it("passes when sets are equal", () => {
    expect(parityIssues(["02-p1"], ["02-p1"], "ja", "02")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/check.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/check").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/check.ts
import { Block } from "./blocks";

export interface CheckIssue {
  lang: string;
  chapter: string;
  kind:
    | "missing-marker"
    | "duplicate-id"
    | "missing-in-translation"
    | "extra-in-translation";
  detail: string;
}

export function missingOrDuplicateIds(
  blocks: Block[],
  lang: string,
  chapter: string
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const seen = new Set<string>();
  blocks.forEach((b, i) => {
    if (b.id === null) {
      issues.push({ lang, chapter, kind: "missing-marker", detail: `block #${i}` });
    } else if (seen.has(b.id)) {
      issues.push({ lang, chapter, kind: "duplicate-id", detail: b.id });
    } else {
      seen.add(b.id);
    }
  });
  return issues;
}

export function parityIssues(
  enIds: string[],
  langIds: string[],
  lang: string,
  chapter: string
): CheckIssue[] {
  const en = new Set(enIds);
  const lg = new Set(langIds);
  const issues: CheckIssue[] = [];
  for (const id of en) {
    if (!lg.has(id)) issues.push({ lang, chapter, kind: "missing-in-translation", detail: id });
  }
  for (const id of lg) {
    if (!en.has(id)) issues.push({ lang, chapter, kind: "extra-in-translation", detail: id });
  }
  return issues;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/check.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the check CLI**

```ts
// site/scripts/check-markers.ts
import { readFileSync } from "node:fs";
import { loadConfig, listChapters, chaptersDir } from "../src/lib/sources";
import { parseChapter } from "../src/lib/blocks";
import { missingOrDuplicateIds, parityIssues, CheckIssue } from "../src/lib/check";

const configPath = process.argv[2] ?? "config.json";
const { config, baseDir } = loadConfig(configPath);
const en = config.sources.find((s) => s.lang === "en");
if (!en) throw new Error("config must include an 'en' source");

const issues: CheckIssue[] = [];
const enIdsByChapter = new Map<string, string[]>();

for (const [chapter, file] of listChapters(chaptersDir(baseDir, en))) {
  const blocks = parseChapter(readFileSync(file, "utf8"));
  issues.push(...missingOrDuplicateIds(blocks, "en", chapter));
  enIdsByChapter.set(chapter, blocks.map((b) => b.id ?? ""));
}

for (const src of config.sources) {
  for (const [chapter, file] of listChapters(chaptersDir(baseDir, src))) {
    const blocks = parseChapter(readFileSync(file, "utf8"));
    issues.push(...missingOrDuplicateIds(blocks, src.lang, chapter));
    if (src.lang !== "en") {
      const enIds = enIdsByChapter.get(chapter) ?? [];
      issues.push(...parityIssues(enIds, blocks.map((b) => b.id ?? ""), src.lang, chapter));
    }
  }
}

if (issues.length > 0) {
  for (const i of issues) console.error(`✗ ${i.lang} ${i.chapter} [${i.kind}] ${i.detail}`);
  console.error(`\n${issues.length} issue(s). Run: pnpm run blocks:inject`);
  process.exit(1);
}
console.log("✓ all block markers valid and aligned");
```

- [ ] **Step 6: Run the check against the real sources**

Run (from `site/`): `pnpm run blocks:check`
Expected: `✓ all block markers valid and aligned` (exit 0). (Sources were injected in Task 8.)

- [ ] **Step 7: Commit**

```bash
git add site/src/lib/check.ts site/scripts/check-markers.ts site/tests/check.test.ts
git commit -m "feat(site): cross-language marker parity/uniqueness check"
```

---

## Task 11: anchors.json builder + CLI

**Files:**
- Create: `site/src/lib/anchors.ts`
- Create: `site/scripts/build-anchors.ts`
- Test: `site/tests/anchors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildChapterAnchors } from "../src/lib/anchors";
import { blockHashFromNormalized } from "../src/lib/hash";

describe("buildChapterAnchors", () => {
  it("keys entries by blockId with order, text and hash", () => {
    const src = "<!-- block: 02-p1 -->\nHello\n\n<!-- block: 02-p2 -->\nWorld";
    const anchors = buildChapterAnchors(src);
    expect(Object.keys(anchors)).toEqual(["02-p1", "02-p2"]);
    expect(anchors["02-p1"]).toEqual({
      blockId: "02-p1",
      order: 0,
      text: "Hello",
      blockHash: blockHashFromNormalized("Hello"),
    });
    expect(anchors["02-p2"].order).toBe(1);
  });
  it("throws if a block has no id", () => {
    expect(() => buildChapterAnchors("no marker")).toThrow(/no id/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/anchors.test.ts`
Expected: FAIL ("Cannot find module ../src/lib/anchors").

- [ ] **Step 3: Write minimal implementation**

```ts
// site/src/lib/anchors.ts
import { parseChapter } from "./blocks";
import { normalizeBlockText } from "./normalize";
import { blockHashFromNormalized } from "./hash";

export interface AnchorEntry {
  blockId: string;
  order: number;
  text: string;
  blockHash: `0x${string}`;
}

/** blockId -> entry, in document order. */
export type ChapterAnchors = Record<string, AnchorEntry>;

export function buildChapterAnchors(source: string): ChapterAnchors {
  const out: ChapterAnchors = {};
  parseChapter(source).forEach((b, i) => {
    if (b.id === null) {
      throw new Error(`block #${i} has no id (run blocks:inject before anchors:build)`);
    }
    const text = normalizeBlockText(b.content);
    out[b.id] = { blockId: b.id, order: i, text, blockHash: blockHashFromNormalized(text) };
  });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/anchors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the build-anchors CLI**

```ts
// site/scripts/build-anchors.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, listChapters, chaptersDir, sourceIdHash } from "../src/lib/sources";
import { buildChapterAnchors, ChapterAnchors } from "../src/lib/anchors";

const configPath = process.argv[2] ?? "config.json";
const outDir = resolve(process.argv[3] ?? "anchors");
const { config, baseDir } = loadConfig(configPath);
mkdirSync(outDir, { recursive: true });

for (const src of config.sources) {
  const chapters: Record<string, ChapterAnchors> = {};
  for (const [chapter, file] of listChapters(chaptersDir(baseDir, src))) {
    chapters[chapter] = buildChapterAnchors(readFileSync(file, "utf8"));
  }
  const doc = {
    lang: src.lang,
    sourceIdentifier: src.sourceId,
    sourceId: sourceIdHash(src.sourceId),
    chapters,
  };
  const out = resolve(outDir, `${src.lang}.json`);
  writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
  console.log(`wrote ${out}`);
}
```

- [ ] **Step 6: Build anchors against the real sources**

Run (from `site/`): `pnpm run anchors:build`
Expected: `wrote .../site/anchors/en.json` and `.../site/anchors/ja.json`.

Run: `node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('anchors/ja.json','utf8')); console.log(d.lang, Object.keys(d.chapters).length, Object.keys(d.chapters['02']).length)"`
Expected: `ja 8 <n>` where `<n>` is chapter 02's block count (matches the `grep -c` from Task 8).

(`anchors/` is gitignored — do not commit it.)

- [ ] **Step 7: Commit**

```bash
git add site/src/lib/anchors.ts site/scripts/build-anchors.ts site/tests/anchors.test.ts
git commit -m "feat(site): emit per-language anchors.json"
```

---

## Task 12: CI workflow

**Files:**
- Create: `.github/workflows/site-checks.yml` (repo root)

- [ ] **Step 1: Write the workflow**

```yaml
name: site-checks

on:
  push:
    branches: [feat/commentary, main]
  pull_request:

jobs:
  blocks:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: site
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: site/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm run blocks:check
      - run: pnpm run anchors:build
```

- [ ] **Step 2: Validate the workflow YAML locally**

Run (from `site/`): `node -e "const fs=require('fs');const s=fs.readFileSync('../.github/workflows/site-checks.yml','utf8');if(!/working-directory: site/.test(s))throw new Error('bad');console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/site-checks.yml
git commit -m "ci: run site pipeline tests + block checks"
```

---

## Task 13: Pipeline docs + final verification

**Files:**
- Modify: `site/README.md`

- [ ] **Step 1: Add a Pipeline section to `site/README.md`**

Append the following section to the end of `site/README.md`:

```markdown
## Content pipeline (M1)

Run from `site/`:

- `pnpm run blocks:inject` — inject/normalize `<!-- block: NN-pM -->` markers in the
  configured sources. English (`source/en`) is the id authority; translations mirror
  EN ids by position. Idempotent.
- `pnpm run blocks:check` — validate that every block has a unique marker and that each
  translation's id set matches English (used in CI).
- `pnpm run anchors:build` — emit `anchors/<lang>.json` (`blockId -> { order, text,
  blockHash }`) for the runtime re-anchoring layer. Output is gitignored.
- `pnpm test` — unit tests for normalization, hashing, parsing, ids, injection, checks,
  anchors.

Sources are declared in `config.json`. Markers are invisible in Markdown renderers and
stripped from the merged manuscript by `scripts/build.py`.
```

- [ ] **Step 2: Full-suite verification**

Run (from `site/`): `pnpm test`
Expected: PASS — all suites (smoke, normalize, hash, ids, blocks, sources, inject, check, anchors).

Run (from `site/`): `pnpm run blocks:check`
Expected: `✓ all block markers valid and aligned`.

- [ ] **Step 3: Commit**

```bash
git add site/README.md
git commit -m "docs(site): document the M1 content pipeline"
```

---

## Self-Review notes (for the planner)

- **Spec coverage (M1):** marker auto-injection (Tasks 7–8), normalization (Task 2), hashing (Task 3), block parsing (Task 5), cross-language parity + uniqueness CI (Tasks 10, 12), `anchors.json` emission (Task 11). Marker invisibility/stripping (Task 9). Config-driven sources (Task 6).
- **Shared logic:** normalize/hash/blocks/ids live in `src/lib/` so M3 (browser re-anchoring) imports the exact same functions — do not duplicate them later.
- **Known assumptions (documented in tasks):** blocks are blank-line delimited (paragraphs/headings); translations align to EN **by position** and must have equal block counts (Task 8 errors otherwise); `config.json` only (YAML support deferred); `anchors/` is a build artifact (gitignored).
- **Out of scope (later milestones):** Astro/Tailwind/Base UI app and reading view (M2), the re-anchoring classifier `anchored/re-anchored/orphaned/needs-review` (M3), wallet + EAS write (M4), EAS read + projection (M5), deploy (M6).
