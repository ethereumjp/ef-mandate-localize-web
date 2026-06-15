# Widget Button Toggle + In-Sidebar Composer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the floating widget button a show/hide toggle + count (2 cells), fold the post composer into the sidebar (replacing the centered modal), and move the wallet button into the sidebar header.

**Architecture:** Stage 1 (`loader.ts`, framework-free) owns a 2-cell pill: cell 1 (💬) toggles `display` highlight visibility (persisted in `localStorage`, default OFF); cell 2 (count) lazy-loads Stage 2 and opens the panel. `display.ts` is refactored so projection (the list data) always runs and only *painting* is gated by visibility. Stage 2 (`app.tsx`) renders a `Panel` shell (wallet + count + close, plus a back button in compose mode) whose body switches between the comment list and an inline composer.

**Tech stack:** TypeScript, React 19, wagmi 3, viem 2, Base UI (Dialog being removed), Tailwind v4 (into shadow via `?inline`), Vite 7 (2-entry ESM build), vitest 2 + jsdom. Run all commands from `commentary/`.

**Baseline:** clean working tree on `feat/widget-embed` (focus fix `501f5df`, gitignore `408c243`). `pnpm -r test` = 108 (60 core + 41 site + 7 widget); `pnpm -r typecheck` clean.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `commentary/widget/src/display.ts` | Stage-1 read controller | Split `paint()` into always-on `project()` + visibility-gated `paintHighlights()`; export pure `projectComments()` |
| `commentary/widget/test/display.test.ts` | unit test | **new** — `projectComments` projects regardless of visibility |
| `commentary/widget/src/loader.ts` | Stage-1 mount + button | 2-cell pill (💬 toggle + count open) + `localStorage` persistence |
| `commentary/widget/src/comments/i18n.ts` | comment-UI strings | add composer/panel keys (en + ja) |
| `commentary/widget/src/comments/Panel.tsx` | sidebar shell (header + body slot) | **new** |
| `commentary/widget/src/comments/CommentThread.tsx` | the comment list | reduce to the list body (chrome moves to `Panel`) |
| `commentary/widget/src/comments/Composer.tsx` | post form | Dialog → inline form, collapsible on-chain details, i18n labels |
| `commentary/widget/src/app.tsx` | Stage-2 controller | panel mode state (list/compose), wallet→header, selection→compose, drop portal |

---

## Task 1: Split projection from painting in `display.ts`

Today `paint()` clears `byBlock` when hidden, so `projected()` (the list) is empty unless highlights are on. Decouple them: projection always runs (list/count work hidden); only painting honours `visible`.

**Files:**
- Modify: `commentary/widget/src/display.ts`
- Test: `commentary/widget/test/display.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `commentary/widget/test/display.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { projectComments } from "../src/display";
import { blockHash } from "@commentary/core/lib/hash";
import { normalizeBlockText } from "@commentary/core/lib/normalize";
import type { StoredAnno } from "@commentary/core/anno/locate";

const ZERO = "0x" + "00".repeat(32);

function stored(over: Partial<StoredAnno> = {}): StoredAnno {
  const text = "the walkaway test";
  return {
    uid: "0x1",
    attester: "0xabc0000000000000000000000000000000000000",
    time: 0,
    revoked: false,
    url: "https://x/",
    urlCanonical: "https://x/",
    origin: "https://x",
    lang: "en",
    rootSelector: '[data-block-id="t1"]',
    containerHash: blockHash(normalizeBlockText(text)),
    spanStart: 4,
    spanEnd: 12,
    spanExact: "walkaway",
    spanPrefix: "the ",
    spanSuffix: " test",
    parentUid: ZERO,
    body: "hi",
    meta: "",
    ...over,
  } as StoredAnno;
}

describe("projectComments", () => {
  it("projects page comments into byBlock (independent of highlight visibility)", () => {
    document.body.innerHTML = '<p data-block-id="t1">the walkaway test</p>';
    const byBlock = projectComments([stored()], "https://x/");
    const items = [...byBlock.values()].flat();
    expect(items).toHaveLength(1);
    expect(items[0].comment.uid).toBe("0x1");
  });

  it("scopes to the page's canonical URL", () => {
    document.body.innerHTML = '<p data-block-id="t1">the walkaway test</p>';
    const byBlock = projectComments([stored({ urlCanonical: "https://other/" })], "https://x/");
    expect([...byBlock.values()].flat()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @commentary/widget test`
Expected: FAIL — `projectComments` is not exported from `../src/display`.

- [ ] **Step 3: Refactor `display.ts`**

Replace the `paint()` function (current lines ~69–97) and the returned object's `refresh`/`setVisible` so projection and painting are separate. Add the exported pure helper near the top (after the `DisplayOpts`/`Display` interfaces, before `caretFromPoint`):

```ts
/**
 * Group page-scoped comments by rootSelector and project each onto the live DOM.
 * Pure of visibility/painting, so the list + count work even while highlights are
 * hidden. Blocks not present on the page are skipped (their comments don't list).
 */
export function projectComments(
  stored: StoredAnno[],
  urlCanonical: string,
): Map<string, LocatedAnno[]> {
  const byBlock = new Map<string, LocatedAnno[]>();
  const groups = new Map<string, StoredAnno[]>();
  for (const c of commentsForUrl(stored, urlCanonical)) {
    const arr = groups.get(c.rootSelector) ?? [];
    arr.push(c);
    groups.set(c.rootSelector, arr);
  }
  for (const [rootSelector, group] of groups) {
    const blockEl = document.querySelector(rootSelector);
    if (!blockEl) continue;
    byBlock.set(rootSelector, projectAnno(blockEl, group));
  }
  return byBlock;
}
```

Inside `createDisplay`, change `const byBlock` to `let byBlock`, and replace `paint()` with `project()` + `paintHighlights()`:

```ts
export function createDisplay(opts: DisplayOpts): Display {
  let byBlock = new Map<string, LocatedAnno[]>();
  let stored: StoredAnno[] = [];
  let visible = false;
  let clickCb: ((uid: string) => void) | null = null;

  function pageScoped(): StoredAnno[] {
    return commentsForUrl(stored, canonicalizeUrl(location.href).urlCanonical);
  }

  // Always rebuild the projection (list/count data), regardless of visibility.
  function project(): void {
    byBlock = projectComments(stored, canonicalizeUrl(location.href).urlCanonical);
  }

  // Paint (or clear) the underline markers; gated by `visible` only.
  function paintHighlights(): void {
    if (!visible) {
      applyHighlights("comment", []);
      applyHighlights("comment-focus", []);
      return;
    }
    const ranges: Range[] = [];
    for (const [rootSelector, items] of byBlock) {
      const blockEl = document.querySelector(rootSelector);
      if (!blockEl) continue;
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

The `onDocClick` hit-test is unchanged (still guarded by `if (!visible || !clickCb) return;` and iterates `byBlock`). In the returned object, update `refresh`, `setVisible`, and `dispose`:

```ts
    async refresh() {
      stored = opts.mock
        ? loadMockComments()
        : await fetchAnno(opts.schemaUid, { endpoint: opts.easGraphql });
      project();
      paintHighlights();
    },
    setVisible(on: boolean) {
      visible = on;
      paintHighlights();
    },
```

```ts
    dispose() {
      document.removeEventListener("click", onDocClick);
      applyHighlights("comment", []);
      applyHighlights("comment-focus", []);
      byBlock = new Map();
    },
```

`count()`, `projected()`, `onClickHighlight()`, and `focus()` are unchanged (they already read `byBlock`/`stored`, which now stay populated).

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @commentary/widget test`
Expected: PASS — `test/display.test.ts` (2) + existing `highlight`/`thread` tests.

- [ ] **Step 5: Typecheck the workspace**

Run: `pnpm -r typecheck`
Expected: 3 packages clean.

- [ ] **Step 6: Commit**

```bash
git add commentary/widget/src/display.ts commentary/widget/test/display.test.ts
git commit -m "refactor(widget): split display projection from highlight painting

projectComments() always builds byBlock so the list/count work while
highlights are hidden; setVisible only gates painting."
```

---

## Task 2: 2-cell floating button (`loader.ts`)

Replace the single `💬 {count}` pill with a 2-cell pill: cell 1 (💬) toggles highlight visibility (persisted, default OFF); cell 2 (count) opens the panel.

**Files:**
- Modify: `commentary/widget/src/loader.ts` (rewrite)

- [ ] **Step 1: Rewrite `loader.ts`**

Replace the whole file with:

```ts
// Stage 1 (loader): tiny, no React/wallet. Reads config, mounts a host element +
// shadow root + a 2-cell floating pill — 💬 toggles highlight visibility (persisted,
// default OFF), the count opens the panel. Runs the framework-free display
// controller and lazy-imports the heavy React app on interaction.
import { readConfig } from "./config";
import { createDisplay } from "./display";

const VKEY = "commentary:visible";
function readVisible(): boolean {
  try {
    return localStorage.getItem(VKEY) === "1";
  } catch {
    return false; // private mode → default OFF, in-memory only
  }
}
function writeVisible(on: boolean): void {
  try {
    localStorage.setItem(VKEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// Heroicons chat-bubble path, shared by the toggle's on/off renders.
const BUBBLE =
  '<path d="M12 20.25c4.97 0 9-3.69 9-8.25s-4.03-8.25-9-8.25S3 7.44 3 12c0 2.1.86 4.02 2.27 5.48.43.45.74 1.04.59 1.64a4.5 4.5 0 0 1-.92 1.79A5.97 5.97 0 0 0 6 21c1.28 0 2.47-.4 3.45-1.09.81.22 1.67.34 2.55.34Z"/>';

function mount(): void {
  if (document.getElementById("commentary-widget")) return; // singleton guard
  const config = readConfig();

  const host = document.createElement("div");
  host.id = "commentary-widget";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const side = config.position === "bottom-left" ? "left:20px" : "right:20px";
  const pill = document.createElement("div");
  pill.style.cssText =
    `position:fixed;bottom:20px;${side};z-index:2147483646;display:inline-flex;align-items:center;` +
    "background:#1c1917;border-radius:9999px;box-shadow:0 4px 16px rgba(0,0,0,.2);overflow:hidden";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.style.cssText =
    "display:flex;align-items:center;justify-content:center;border:none;background:transparent;cursor:pointer;padding:11px 13px";

  const divider = document.createElement("span");
  divider.style.cssText = "width:1px;align-self:stretch;background:rgba(255,255,255,.18)";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.setAttribute("aria-label", "Open comments");
  openBtn.style.cssText =
    "border:none;background:transparent;cursor:pointer;padding:11px 15px;color:#fff;font:600 14px/1 system-ui";

  pill.append(toggleBtn, divider, openBtn);
  shadow.appendChild(pill);

  const display = createDisplay({
    schemaUid: config.schemaUid,
    easGraphql: config.easGraphql,
    mock: config.mock,
  });

  let visible = readVisible();

  function renderToggle(): void {
    const stroke = visible ? "#fde68a" : "#a8a29e";
    const slash = visible
      ? ""
      : '<line x1="3.5" y1="3.5" x2="20.5" y2="20.5" stroke="#a8a29e" stroke-width="1.7"/>';
    toggleBtn.style.background = visible ? "rgba(251,191,36,.22)" : "transparent";
    const label = visible ? "Hide comments" : "Show comments";
    toggleBtn.title = label;
    toggleBtn.setAttribute("aria-label", label);
    toggleBtn.setAttribute("aria-pressed", String(visible));
    toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7">${BUBBLE}${slash}</svg>`;
  }
  function renderCount(): void {
    openBtn.textContent = String(display.count());
  }

  let appMod: typeof import("./app") | null = null;
  let mounted = false;
  let focusWhileOpen: ((uid: string) => void) | null = null;
  async function openApp(focusUid?: string): Promise<void> {
    if (mounted) {
      if (focusUid) focusWhileOpen?.(focusUid); // already open → just focus the span
      return;
    }
    mounted = true;
    if (!appMod) appMod = await import("./app");
    appMod.mountApp(shadow, config, display, {
      focusUid,
      onFocusReady: (fn) => {
        focusWhileOpen = fn;
      },
      onUnmount: () => {
        mounted = false;
        focusWhileOpen = null;
      },
    });
  }

  toggleBtn.addEventListener("click", () => {
    visible = !visible;
    writeVisible(visible);
    display.setVisible(visible);
    renderToggle();
  });
  openBtn.addEventListener("click", () => void openApp());
  display.onClickHighlight((uid) => void openApp(uid));

  void display.refresh().then(() => {
    display.setVisible(visible); // apply persisted state (paints if ON)
    renderToggle();
    renderCount();
  });
}

mount();
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: clean.

- [ ] **Step 3: Build the embed**

Run: `pnpm --filter @commentary/widget build`
Expected: emits `dist/embed.js` (+ `app` chunk); no errors. `embed.js` gz stays ~15 KB (Stage 1 still has no React).

- [ ] **Step 4: Commit**

```bash
git add commentary/widget/src/loader.ts
git commit -m "feat(widget): 2-cell button — 💬 show/hide toggle + count opens panel

Visibility persists per origin (localStorage, default OFF). Cell 1 reflects
state (amber+lit / grey+slash); cell 2 shows display.count() and opens Stage 2."
```

(Runtime button behaviour is verified in Task 5.)

---

## Task 3: Composer/panel i18n strings (`comments/i18n.ts`)

**Files:**
- Modify: `commentary/widget/src/comments/i18n.ts`

- [ ] **Step 1: Add keys to both language tables**

In the `en` object, after `statusOrphaned: "Block removed",` add:

```ts
    back: "Comments",
    compose: "New comment",
    composePlaceholder: "Write a comment…",
    onchainDetails: "On-chain record (EAS)",
    publish: "Publish",
    publishing: "Publishing…",
    connectToPublish: "Connect to publish",
```

In the `ja` object, after `statusOrphaned: "ブロックが削除されました",` add:

```ts
    back: "コメント一覧",
    compose: "新規コメント",
    composePlaceholder: "コメントを書く…",
    onchainDetails: "オンチェーン記録 (EAS)",
    publish: "公開",
    publishing: "公開中…",
    connectToPublish: "接続して公開",
```

(`CommentStringKey` derives from the `en` keys, so the new keys are typed automatically.)

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: clean (keys unused until Task 4 — that's fine).

- [ ] **Step 3: Commit**

```bash
git add commentary/widget/src/comments/i18n.ts
git commit -m "feat(widget): i18n strings for the in-sidebar composer (en/ja)"
```

---

## Task 4: Panel shell + in-sidebar composer (the panel refactor)

This is the cohesive change that must land together for a green build: introduce `Panel.tsx` (the sidebar chrome), reduce `CommentThread` to the list body, turn `Composer` into an inline form, and rewrite the `app.tsx` controller to drive a list/compose mode with the wallet in the header.

**Files:**
- Create: `commentary/widget/src/comments/Panel.tsx`
- Modify: `commentary/widget/src/comments/CommentThread.tsx`
- Modify: `commentary/widget/src/comments/Composer.tsx`
- Modify: `commentary/widget/src/app.tsx`

- [ ] **Step 1: Create `Panel.tsx`**

```tsx
import type { ReactNode } from "react";
import { ct } from "./i18n";

interface Props {
  lang: string;
  count: number;
  mode: "list" | "compose";
  /** Wallet control (ConnectButton) rendered in the header — built inside the providers. */
  wallet: ReactNode;
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Fixed right sidebar shell: header (wallet · title/count or back · close) + a
 * scrollable body slot. Layout-independent (pinned to the viewport) so it works
 * on any host. The body is the comment list or the composer, chosen by the caller.
 */
export function Panel({ lang, count, mode, wallet, onBack, onClose, children }: Props) {
  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-[340px] max-w-[85vw] flex-col border-l border-stone-200 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-2.5 dark:border-stone-700">
        {mode === "compose" ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <span aria-hidden="true">←</span> {ct(lang, "back")}
          </button>
        ) : (
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {ct(lang, "threadTitle")}
            {count > 0 ? (
              <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">{count}</span>
            ) : null}
          </h2>
        )}
        <div className="flex items-center gap-2">
          {wallet}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
```

- [ ] **Step 2: Reduce `CommentThread.tsx` to the list body**

Replace the whole file (drop the outer `<aside>`/header — now in `Panel` — and the `onClose` prop):

```tsx
import { useEffect, useRef } from "react";
import type { LocatedAnno } from "@commentary/core/anno/locate";
import { buildThreads } from "../web3/thread";
import { ct } from "./i18n";
import { CommentCard } from "./CommentCard";

interface Props {
  /** All projected comments for the page (document order), threaded by parentUid. */
  comments: LocatedAnno[];
  lang: string;
  focusedUid: string | null;
  pendingUids: Set<string>;
  onFocus: (uid: string) => void;
}

/** The comment list body (rendered inside Panel). Scrolls a card into view on focus. */
export function CommentThread({ comments, lang, focusedUid, pendingUids, onFocus }: Props) {
  const projByUid = new Map(comments.map((p) => [p.comment.uid, p.projection]));
  const threads = buildThreads(comments.map((p) => p.comment));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusedUid || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-uid="${CSS.escape(focusedUid)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedUid]);

  return (
    <div ref={listRef}>
      {comments.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-stone-400">{ct(lang, "noComments")}</p>
      ) : null}
      {threads.map((n) => (
        <CommentCard
          key={n.comment.uid}
          node={n}
          projection={projByUid.get(n.comment.uid)}
          lang={lang}
          focusedUid={focusedUid}
          pendingUids={pendingUids}
          onFocus={onFocus}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `Composer.tsx` as an inline form**

Replace the whole file (remove `Dialog`/`Portal`/`Backdrop`/`container`; add collapsible details + i18n):

```tsx
import { useState } from "react";
import type { AnnoFields } from "@commentary/core/anno/schema";
import { ct } from "./i18n";

const shortHex = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);

interface Props {
  /** The anchored fields for the current selection (quote + on-chain preview). */
  fields: AnnoFields | null;
  lang: string;
  pending?: boolean;
  error?: string | null;
  connected?: boolean;
  onConnect?: () => void;
  onSubmit: (body: string) => void;
  schemaUid?: string;
}

/** Inline composer rendered in the Panel body when mode === "compose". */
export function Composer({
  fields,
  lang,
  pending,
  error,
  connected = true,
  onConnect,
  onSubmit,
  schemaUid,
}: Props) {
  const [body, setBody] = useState("");
  return (
    <div className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
        {ct(lang, "compose")}
      </p>
      {fields ? (
        <blockquote className="mt-2 border-l-2 border-amber-300 pl-2 text-xs italic leading-snug text-stone-500 dark:border-amber-500/60 dark:text-stone-400">
          “{fields.spanExact}”
        </blockquote>
      ) : null}
      <textarea
        className="mt-3 h-28 w-full rounded border border-stone-300 bg-transparent p-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={!connected}
        aria-label="Comment"
        placeholder={connected ? ct(lang, "composePlaceholder") : ""}
      />
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {fields ? (
        <details className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          <summary className="cursor-pointer select-none">{ct(lang, "onchainDetails")}</summary>
          <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-2 border-t border-stone-100 pt-2 font-mono dark:border-stone-800">
            <dt>lang</dt>
            <dd>{fields.lang}</dd>
            <dt>origin</dt>
            <dd className="truncate">{fields.origin}</dd>
            <dt>url</dt>
            <dd className="truncate">{fields.urlCanonical}</dd>
            <dt>rootSelector</dt>
            <dd className="truncate">{fields.rootSelector}</dd>
            <dt>containerHash</dt>
            <dd className="truncate">{shortHex(fields.containerHash)}</dd>
            <dt>spanStart</dt>
            <dd>{fields.spanStart}</dd>
            <dt>spanEnd</dt>
            <dd>{fields.spanEnd}</dd>
            <dt>spanExact</dt>
            <dd className="truncate">{fields.spanExact}</dd>
            <dt>spanPrefix</dt>
            <dd className="truncate">{fields.spanPrefix}</dd>
            <dt>spanSuffix</dt>
            <dd className="truncate">{fields.spanSuffix}</dd>
            <dt>parentUid</dt>
            <dd className="truncate">{shortHex(fields.parentUid)}</dd>
            <dt>meta</dt>
            <dd className="truncate">{fields.meta || "—"}</dd>
            <dt>body</dt>
            <dd className="truncate">{body ? `"${body}"` : "—"}</dd>
          </dl>
          {schemaUid ? (
            <a
              href={`https://sepolia.easscan.org/schema/view/${schemaUid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block underline hover:text-stone-600 dark:hover:text-stone-300"
            >
              EAS schema ↗
            </a>
          ) : null}
        </details>
      ) : null}
      <div className="mt-4 flex justify-end">
        {connected ? (
          <button
            type="button"
            className="rounded-full w-full bg-stone-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
            disabled={pending || body.trim() === ""}
            onClick={() => onSubmit(body.trim())}
          >
            {pending ? ct(lang, "publishing") : ct(lang, "publish")}
          </button>
        ) : (
          <button
            type="button"
            className="rounded-full w-full bg-stone-900 px-3 py-1 text-sm text-white dark:bg-stone-100 dark:text-stone-900"
            onClick={onConnect}
          >
            {ct(lang, "connectToPublish")}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the controller in `app.tsx`**

Replace the import block, `ControllerProps`, `Controller`, `App`, and `mountApp`. Keep `injectStyles`, `queryClient`, `NO_PENDING`, `styled`, and `SelectionTarget` as they are. Key changes: drop `Composer`'s Dialog props + `portalContainer`; add `mode` state; render `<Panel>` with the wallet in the header and the list/composer in the body.

Replace the imports (the React + component imports at the top) with:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildAnnoFields } from "@commentary/core/anno/author";
import { nearestContainer } from "@commentary/core/anno/selector";
import { encodeAnno } from "@commentary/core/anno/encode";
import type { AnnoFields } from "@commentary/core/anno/schema";
import { buildWagmiConfig } from "./web3/config";
import { useEthersSigner } from "./web3/ethers";
import { attestComment } from "./web3/eas";
import { ConnectButton } from "./comments/ConnectButton";
import { CommentThread } from "./comments/CommentThread";
import { Composer } from "./comments/Composer";
import { Panel } from "./comments/Panel";
import { SelectionPopover } from "./comments/SelectionPopover";
import type { WidgetConfig } from "./config";
import type { Display } from "./display";
import css from "./app.css?inline";
```

Replace `ControllerProps` and `Controller` with:

```tsx
interface ControllerProps {
  config: WidgetConfig;
  display: Display;
  onClose: () => void;
  initialFocusUid?: string;
  onFocusReady?: (fn: (uid: string) => void) => void;
}

function Controller({ config, display, onClose, initialFocusUid, onFocusReady }: ControllerProps) {
  const signer = useEthersSigner();
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const [comments, setComments] = useState(display.projected());
  const [focusedUid, setFocusedUid] = useState<string | null>(initialFocusUid ?? null);
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [mode, setMode] = useState<"list" | "compose">("list");
  const [composerFields, setComposerFields] = useState<AnnoFields | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerPending, setComposerPending] = useState(false);
  const captured = useRef<SelectionTarget | null>(null);

  // selectionchange → popover (only while listing; hidden during compose).
  useEffect(() => {
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
      const raw = range.getBoundingClientRect();
      const rect = new DOMRect(raw.left, Math.max(8, raw.top - 36), raw.width, raw.height);
      setSelection({ container, range: range.cloneRange(), rect });
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const handleFocus = useCallback(
    (uid: string) => {
      setFocusedUid(uid);
      display.focus(uid);
    },
    [display],
  );
  useEffect(() => {
    if (initialFocusUid) handleFocus(initialFocusUid);
    onFocusReady?.(handleFocus);
    return () => display.focus(null);
  }, [initialFocusUid, onFocusReady, handleFocus, display]);

  function fieldsFor(target: SelectionTarget, body: string): AnnoFields | null {
    return buildAnnoFields({ href: location.href, lang: config.lang, range: target.range, body });
  }

  function openComposer() {
    captured.current = selection;
    setComposerError(null);
    setComposerFields(selection ? fieldsFor(selection, "") : null);
    setMode("compose");
  }

  function backToList() {
    setMode("list");
    setComposerError(null);
  }

  async function handleSubmit(body: string) {
    const target = captured.current;
    if (!target) return;
    if (!signer || !config.schemaUid) {
      setComposerError("Connect a wallet on Sepolia to publish.");
      return;
    }
    const fields = fieldsFor(target, body);
    if (!fields) {
      setComposerError("Could not anchor the selection. Try selecting within a single block.");
      return;
    }
    setComposerPending(true);
    try {
      await attestComment(signer, config.schemaUid, encodeAnno(fields));
      await display.refresh();
      setComments(display.projected());
      setMode("list");
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : String(err));
    } finally {
      setComposerPending(false);
    }
  }

  return (
    <>
      {selection && mode === "list" ? (
        <SelectionPopover rect={selection.rect} onClick={openComposer} />
      ) : null}
      <Panel
        lang={config.lang}
        count={comments.length}
        mode={mode}
        wallet={<ConnectButton />}
        onBack={backToList}
        onClose={onClose}
      >
        {mode === "compose" ? (
          <Composer
            key={composerFields?.spanExact ?? "compose"}
            fields={composerFields}
            lang={config.lang}
            pending={composerPending}
            error={composerError}
            connected={isConnected}
            onConnect={() => connect({ connector: injected() })}
            onSubmit={handleSubmit}
            schemaUid={config.schemaUid}
          />
        ) : (
          <CommentThread
            comments={comments}
            lang={config.lang}
            focusedUid={focusedUid}
            pendingUids={NO_PENDING}
            onFocus={handleFocus}
          />
        )}
      </Panel>
    </>
  );
}
```

Replace `App` and `mountApp` (drop `portalContainer`):

```tsx
function App(props: ControllerProps) {
  const [wagmiConfig] = useState(() => buildWagmiConfig({ rpc: props.config.rpc }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Controller {...props} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function mountApp(
  container: ShadowRoot,
  config: WidgetConfig,
  display: Display,
  opts?: {
    focusUid?: string;
    onFocusReady?: (fn: (uid: string) => void) => void;
    onUnmount?: () => void;
  },
): void {
  injectStyles(container);
  const el = document.createElement("div");
  container.appendChild(el);
  const root = createRoot(el);
  const close = () => {
    root.unmount();
    el.remove();
    opts?.onUnmount?.();
  };
  root.render(
    <App
      config={config}
      display={display}
      onClose={close}
      initialFocusUid={opts?.focusUid}
      onFocusReady={opts?.onFocusReady}
    />,
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm -r typecheck`
Expected: clean. (If TS flags an unused `@base-ui-components/react` import anywhere, ensure no file still imports `Dialog` — only `Composer.tsx` did, and it's rewritten.)

- [ ] **Step 6: Build the embed**

Run: `pnpm --filter @commentary/widget build`
Expected: builds; `dist/embed.js` + app chunk emitted.

- [ ] **Step 7: Run tests**

Run: `pnpm -r test`
Expected: 110 (60 core + 41 site + 9 widget — `display.test` added 2).

- [ ] **Step 8: Commit**

```bash
git add commentary/widget/src/comments/Panel.tsx commentary/widget/src/comments/CommentThread.tsx commentary/widget/src/comments/Composer.tsx commentary/widget/src/app.tsx
git commit -m "feat(widget): in-sidebar composer + wallet-in-header panel

Panel shell hosts list/compose modes; Composer is now an inline form with a
collapsible on-chain details block (no centered Dialog); ConnectButton moves
into the header. Selection → compose mode; publish → back to list."
```

---

## Task 5: Build, copy to site, browser-verify, finish

The embed is runtime-unverifiable without a browser. Use the mock dev server.

**Files:** none (verification + sign-off).

- [ ] **Step 1: Rebuild + serve the site in mock mode**

Run: `pnpm --filter @commentary/site run dev:mock`
Open `http://localhost:4321/` (and `/ja`). Hard-refresh (⌘⇧R) to drop the cached bundle.

- [ ] **Step 2: Verify the button (Stage 1)**

- On first load (no stored prefs): highlights **off**; pill shows `[💬(grey, slashed) | {count}]`.
- Tap 💬 → amber underlines appear; cell-1 lights amber (no slash). Tap again → hidden. Reload → state persisted.
- Tap the count → panel opens.

- [ ] **Step 3: Verify the panel + compose (Stage 2)**

- Header shows the wallet button (left of ✕), title/count.
- List renders even when highlights are toggled off (projection decoupled).
- Click a card → page scrolls to the span + amber focus wash (works with base highlights off too).
- Select text in a paragraph → `💬 Comment` popover → click → panel switches to **compose** (quote + textarea + ▸ on-chain details + Publish/Connect); `← Comments` returns to the list.
- Wallet flows (connect / switch to Sepolia / ENS) render in the header.

- [ ] **Step 4: Address any findings**

If something is off, fix in the relevant file, rebuild (`pnpm --filter @commentary/widget build`), re-verify, and commit the fix. Use superpowers:systematic-debugging if a bug isn't obvious.

- [ ] **Step 5: Finish the branch**

Once verified, announce and use **superpowers:finishing-a-development-branch** to integrate `feat/widget-embed` → `feat/commentary` (merge / PR / cleanup per that skill). Note for the maintainer: live (non-mock) commenting still needs the ANNO schema registered (`pnpm --filter @commentary/site anno:schema:register` + `PUBLIC_EAS_ANNO_SCHEMA_UID`).

---

## Self-review

**Spec coverage:**
- Button 2-cell (💬 toggle + count open), default OFF, persisted → Task 2 (+ Task 1 makes the list survive "off"). ✓
- `display.ts` projection/paint split → Task 1. ✓
- Sidebar panel + mode switch + wallet in header → Task 4 (Panel, Controller). ✓
- Composer Dialog → inline + collapsible details → Task 4 (Composer). ✓
- Selection → compose; publish → list → Task 4 (Controller). ✓
- i18n strings → Task 3. ✓
- D1 OFF default → Task 2 `readVisible()` returns false when unset. D2 persist → `writeVisible`. D3 independence → button toggles `display.setVisible` only; panel mode never calls it. ✓
- Testing (unit `display`; browser checklist) → Tasks 1 & 5. ✓

**Placeholder scan:** no TBD/“similar to”/vague steps — full code in every code step. ✓

**Type consistency:** `projectComments(stored, urlCanonical)` (Task 1) matches its test + `project()` call. `mountApp` opts `{focusUid, onFocusReady, onUnmount}` match `loader.ts` (Task 2) and `app.tsx` (Task 4). `Composer` props `{fields, lang, pending, error, connected, onConnect, onSubmit, schemaUid}` match the Controller's usage. `Panel` props `{lang, count, mode, wallet, onBack, onClose, children}` match the Controller. `CommentThread` props dropped `onClose` consistently. ✓
