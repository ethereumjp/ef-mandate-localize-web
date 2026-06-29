# Comment Widget — Phase 3b(+3c): build `embed.js` & migrate the site Implementation Plan

> **For agentic workers:** This is the hardest phase — a from-scratch Shadow-DOM embed + a Vite 2-entry library build whose tooling **cannot be fully verified in advance**. Treat the build/shadow/Tailwind tasks as **iteration-gated** (concrete starting config + "iterate until the gate passes" + documented fallbacks), not pre-verified scripts. RECOMMENDED EXECUTION: **inline/interactive**, fresh session. Run pnpm from `commentary/`.

**Goal:** Ship `@commentary/widget` as a real embeddable `embed.js`: a site owner adds one `<script>` and gets a tally.so-style floating button, wallet sign-in to comment, and a display on/off toggle — all isolated in a Shadow DOM. Then migrate the translation site to consume `embed.js` (retiring its bespoke island), so the site becomes "just another host."

**Architecture (2-stage load):** A light **loader** (no React/wallet) parses config from its `<script data-*>`, mounts a host element + shadow root, injects a floating button, and runs a framework-free **display controller** (fetch → project → paint highlights / count / on-off via `@commentary/core` anno read path). On interaction it lazy-`import()`s the heavy **app** (the React `CommentController`), which mounts into the same shadow root and takes over. Highlights paint on the host document via the Custom Highlight API; only the `::highlight()` rule goes in `document.head`.

**Why 3b+3c are merged:** host-decoupling `CommentController` (own button/toggle/shadow, no `#wallet-slot`/`data-comments`) is incompatible with the site's current island, so the site must switch to `embed.js` in the same phase. (Alternative considered & rejected: dual-mode the controller — more complexity, no benefit once the site is a host.)

**Spec:** `commentary/docs/specs/2026-06-12-embeddable-comment-widget-design.md` (§3, §5, §6, §8, §9, §11, §13). Builds on 3a (the `@commentary/widget` package exists with `comments/*` + `web3/*` + `i18n`).

---

## Preconditions

- Run pnpm from `commentary/`. Baseline: `pnpm -r typecheck` clean, `pnpm -r test` = 107, `pnpm --filter @commentary/site build` OK.
- The ANNO schema must be **registered** for live highlights/commenting end-to-end (`pnpm --filter @commentary/site anno:schema:register` + `PUBLIC_EAS_ANNO_SCHEMA_UID`). Until then, verify with **mock mode** (`PUBLIC_MOCK_COMMENTS=1`) which synthesizes comments from the DOM.
- Read the current `commentary/widget/src/comments/CommentApp.tsx` first — Tasks 1–2 extract/refactor its existing logic; the line refs below are approximate.

## Target module layout (in `commentary/widget/src/`)

```
core-use (Stage 1, no React):  display.ts   (fetch→project→paint→on/off→count)
                               config.ts    (parse <script data-*>)
                               mount.ts      (host element + shadow root + CSS injection)
                               button.ts     (floating launcher + count badge + toggle)
                               loader.ts     (Stage-1 IIFE entry; lazy-imports app)
Stage 2 (React, lazy):         app.tsx       (mounts CommentController into the shadow root)
                               comments/*    (host-decoupled CommentController + UI; from 3a)
                               web3/*         (wagmiConfig made config-built)
build:                         vite.config.ts (2 entries: loader IIFE + app chunk)
```

---

## Task 1: Extract a framework-free display controller (`display.ts`)

Pull the read/paint logic out of `CommentController`'s projection `useEffect` into a standalone module the loader can use without React.

- [ ] **Step 1:** Create `commentary/widget/src/display.ts` exporting a `createDisplay(opts)` that owns: a `fetchAnno(schemaUid, {endpoint})` query (or `loadMockComments()` in mock), `commentsForUrl(merged, canonicalizeUrl(location.href).urlCanonical)`, grouping by `rootSelector`, `projectAnno`, and painting via `rangeForOffsets`/`applyHighlights("comment", ranges)` — exactly mirroring the logic currently in `CommentController` (the `useEffect` that builds `groups`→`resolved`→`ranges`). Expose:
```ts
export interface Display {
  refresh(): Promise<void>;     // fetch + project + paint
  setVisible(on: boolean): void; // paint or clear highlights
  count(): number;               // number of comments for this page
  onClickHighlight(cb: (uid: string) => void): void; // hit-test span clicks
  dispose(): void;
}
export function createDisplay(opts: { schemaUid: string; easGraphql?: string; mock?: boolean }): Display
```
The hit-test logic (`caretFromPoint` + range `comparePoint`) also moves here (it's framework-free).

- [ ] **Step 2:** Unit-test `display.ts` in jsdom with mock comments (paint a known DOM, assert `count()` and that highlight ranges are registered). Gate: `pnpm --filter @commentary/widget test` (add vitest to widget — see Task 7). Commit.

## Task 2: Host-decouple `CommentController`

Make the React controller embed-ready: no host DOM assumptions, mountable into a shadow root, with its own button/toggle state.

- [ ] **Step 1:** Remove the `#wallet-slot` portal (`document.getElementById("wallet-slot")` + `createPortal(ConnectButton, walletSlot)`); render `ConnectButton` inside the widget's panel instead.
- [ ] **Step 2:** Replace the `data-comments` MutationObserver/`commentsEnabled()` coupling with an internal `visible` state driven by the widget's own button (passed in as a prop or via a small shared store with the loader).
- [ ] **Step 3:** Accept a `container: HTMLElement` (the shadow root) prop; point all `createPortal` targets and the base-ui `Dialog` `container` at it (not `document.body`).
- [ ] **Step 4:** Make `web3/config.ts` `wagmiConfig` a **function** `buildWagmiConfig({ network, rpc })` built from parsed config (not module-level env reads); `app.tsx` calls it.
- [ ] Gate: the site island still imported `CommentApp` — it WILL break here; that's expected and fixed in Task 6 (site migration). Keep `pnpm --filter @commentary/widget typecheck` green per step.

## Task 3: Config + mount + button (`config.ts`, `mount.ts`, `button.ts`)

- [ ] **`config.ts`:** read `document.currentScript` data attrs → `{ schemaUid (required), network="sepolia", rpc, easGraphql, position="bottom-right", lang=document.documentElement.lang, theme="auto" }`. Singleton guard (no double-mount).
- [ ] **`mount.ts`:** append one host `<div>` to `document.body`; `attachShadow({mode:"open"})`; helper to inject a CSS string into the shadow via `adoptedStyleSheets` (with a `<style>` fallback); inject the `::highlight(comment)`/`::highlight(comment-focus)` rule into `document.head` (document-global).
- [ ] **`button.ts`:** floating button at `position`, count badge, click → toggle display (Stage 1) / open panel (triggers Stage 2). Hand-written minimal CSS (no Tailwind in Stage 1).
- [ ] Gate: typecheck.

## Task 4: The loader (Stage-1 entry, `loader.ts`)

- [ ] Compose: `config → mount → button → createDisplay → display.refresh()`. Wire the button to `display.setVisible`, the count badge to `display.count()`, and "open panel" / "select text → comment" / "click highlight" to a **lazy** `import("./app")` that calls `mountApp(shadowRoot, config, display)`. Dispose the Stage-1 display when the app takes over.
- [ ] Gate: typecheck. (Runtime verified in Task 5/8.)

## Task 5: The app (Stage-2 entry, `app.tsx`)

- [ ] `export function mountApp(container, config, display)` that `createRoot`s into `container` and renders `<WagmiProvider config={buildWagmiConfig(config)}><QueryClientProvider><CommentController container={container} lang={config.lang} …/></…>`, taking over highlight/focus ownership from the Stage-1 `display`.
- [ ] Gate: typecheck.

## Task 6: Vite 2-entry library build + Tailwind-into-shadow  ← TOOLING RISK

- [ ] **Step 1:** Add `commentary/widget/vite.config.ts` — library build, two inputs: `loader` (IIFE/self-executing, single file → `dist/embed.js`) and `app` (a hashed lazy chunk). Add `vite` + `@tailwindcss/vite` devDeps and a `build` script to `widget/package.json`.
- [ ] **Step 2:** Tailwind for the app CSS, imported as a string (`import css from "./app.css?inline"`) and injected into the shadow root (Task 3 helper). Verify Tailwind preflight stays contained in the shadow.
- [ ] **Step 3 (the trickiest):** the loader resolves the `app` chunk's base URL from `document.currentScript.src` and dynamically imports it, so the include stays one `<script>`. Try Vite `experimental.renderBuiltUrl` / `base: "./"`; **fallback:** compute `new URL("./app-[hash].js", currentScriptSrc)` and `import(/* @vite-ignore */ url)`.
- [ ] **Gates (iterate until all pass):** `pnpm --filter @commentary/widget build` emits `dist/embed.js` + the app chunk; a static test page (`widget/test/index.html`) including `<script src="../dist/embed.js" data-schema-uid=… >` shows the button; `PUBLIC_MOCK_COMMENTS`-style mock data paints highlights; clicking "open" lazy-loads the app and renders the panel inside the shadow root (DevTools: one `#shadow-root`, host CSS not bleeding in).

## Task 7: Widget test runner

- [ ] Add `vitest` + `jsdom` devDeps and `"test": "vitest run"` to `widget/package.json`; move `thread.test`/`highlight.test` from `site/tests` into `widget` (they currently live in site importing `@commentary/widget/web3/*`). Then `pnpm -r test` runs core + site + widget. Gate.

## Task 8: Site migration (3c) — site becomes a host

- [ ] **Step 1:** `commentary/site/src/components/Document.astro` — remove `<CommentApp client:only="react" …/>` and the `@commentary/widget` import; instead include the built embed: `<script src="/embed.js" data-schema-uid={import.meta.env.PUBLIC_EAS_ANNO_SCHEMA_UID} data-lang={lang} is:inline></script>` (copy `widget/dist/embed.js` → `site/public/embed.js` via a workspace build step, or reference the served path).
- [ ] **Step 2:** Retire the host couplings: remove `#wallet-slot` from `Toolbar.astro`, the comments-toggle button from `Toolbar.astro`, and the `data-comments` logic from `scripts/toggles.ts` (the widget owns its toggle now). Drop the now-unused `@commentary/widget` source dep + the unused comment deps (wagmi/eas-sdk/ethers/@tanstack/@base-ui) from `site/package.json`.
- [ ] **Step 3:** A workspace build order so `site` build consumes the freshly built `embed.js` (e.g. root `build` script: `pnpm --filter @commentary/widget build && pnpm --filter @commentary/site build`, with a copy step into `site/public/`).
- [ ] **Gates:** `pnpm -r typecheck/test` green; `pnpm --filter @commentary/site build`; `dev:mock` on `/` and `/ja` shows the floating button + highlights + panel, comments scoped per URL; a *blank* test page also works (proves host-independence).

---

## Self-Review / risk notes

- **Spec coverage:** §3 two-stage → Tasks 1,4,5; §5 shadow/Tailwind/highlight → Tasks 3,6; §6 button/toggle → Tasks 3,4; §8 config → Task 3; §9 wallet config-built → Task 2/5; §11 Vite 2-entry + chunk resolution → Task 6; §10 site-as-host → Task 8.
- **Hardest, least-certain:** Task 6 (Vite 2-entry IIFE + lazy chunk URL from `currentScript.src` + Tailwind into shadow) and the base-ui `Dialog`/`createPortal` shadow `container` plumbing (Task 2/5). Budget iteration; fallbacks documented inline.
- **React-instance note:** the embed bundles its own React (it's a standalone artifact now, not sharing the site's) — fine, since the site no longer renders the island after Task 8.
- **Verification floor:** the site island breaks at Task 2 and is restored only at Task 8 — so keep the whole phase on a sub-branch or land Tasks 1–8 before re-pointing CI/dev at the site, and rely on `widget` build + the static test page in between.
- **Out of scope:** public SaaS, gasless, L2, RTL, Chrome-extension shell.
