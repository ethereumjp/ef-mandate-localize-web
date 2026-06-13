# Widget button + in-sidebar composer — Design

**Date:** 2026-06-13
**Status:** Approved (design), pending implementation plan
**Branch context:** builds on `feat/widget-embed` (the 2-stage embed: light `loader.ts` → lazy React `app.tsx`).

## Goal

Make the floating widget button carry comment **show/hide** + **count**, and fold the **post composer into the sidebar** (replacing the centered modal). The floating wallet button also moves into the sidebar header. Net effect: one self-contained launcher + one panel that does list, compose, and wallet — no centered modal, no floating wallet chrome.

## Background — current state

- **Button** (`loader.ts`, Stage 1): a single dark pill showing `💬 {count}`; clicking opens the panel. There is **no** show/hide toggle (it was removed with the site toolbar in Phase 3c; `display.setVisible(true)` is called once on load, so highlights are always on).
- **`display.ts`** (Stage 1): `refresh()` fetches + `paint()`s. `paint()` **conflates projection and visibility** — when `!visible` it clears highlights *and* leaves `byBlock` empty, so `projected()` (the list data) returns `[]`.
- **Panel** (`app.tsx` Stage 2): `CommentThread` is a fixed right `<aside>` (list). `Composer` is a **centered `Dialog`** (Base UI, portalled into the shadow root). `ConnectButton` floats at `fixed right-[352px] top-3`. `SelectionPopover` ("💬 Comment") appears on text selection and opens the `Composer`.

## Locked decisions

- **D1 — default visibility OFF.** On first load highlights are hidden; the count still shows. Showing comments is opt-in (tap 💬). Matches the pre-3c site default.
- **D2 — persist the toggle** in `localStorage` per origin (key `commentary:visible`). The D1 default applies only when no stored value exists.
- **D3 — visibility is independent of the panel.** Opening/closing the panel never changes the highlight on/off state, and vice-versa.

## Component design

### 1. Floating button — 2-cell pill (`loader.ts`, Stage 1, framework-free)

A rounded dark pill split into two tap zones by a hairline divider:

- **Cell 1 — `💬` comment icon = show/hide toggle.** Tapping flips highlight visibility via `display.setVisible(next)`, persists to `localStorage`, and re-renders the cell.
  - **ON:** amber-tinted cell background + amber icon stroke (`#fde68a`) — reads as "annotations shown," matching the body underline colour.
  - **OFF:** no tint, grey icon (`#a8a29e`) + a diagonal slash line.
- **Cell 2 — count = open panel.** Shows `display.count()`; tapping lazy-loads Stage 2 and opens the panel (current open behaviour).
- Built with hand-written `cssText` + inline SVG (no React/Tailwind in Stage 1). Optional `title` tooltips ("表示 ON/OFF" / "コメント一覧").
- On load: read persisted visibility (default **false** per D1) → `display.setVisible(v0)` → `display.refresh()` → render the count + cell-1 state.

### 2. `display.ts` — split projection from painting (required)

Decouple so the list/count work regardless of highlight visibility:

- **`project()`** (new private): always rebuilds `byBlock` (group page-scoped comments by `rootSelector`, `projectAnno`). Runs on every `refresh()`.
- **`paintHighlights()`** (new private): if `visible`, applies the `comment` highlight ranges; else clears them. Does **not** rebuild `byBlock`.
- `refresh()` = fetch/mock → `project()` → `paintHighlights()`.
- `setVisible(on)` = set flag → `paintHighlights()` only (no re-project).
- `projected()` returns `byBlock` contents — now populated after any `refresh()`, even when hidden.
- `count()` unchanged (page-scoped `stored` length).
- `focus(uid)` unchanged (paints `comment-focus` + scrolls; works regardless of `visible`).

### 3. Sidebar panel (`app.tsx` + new `Panel.tsx`, Stage 2)

- **`Panel.tsx`** (new): the fixed right `<aside>` shell. Header row: **wallet (`ConnectButton`) ｜ title/count ｜ `← back` (compose mode only) ｜ `✕` close**. Below: a scrollable body slot. Owns the panel chrome that currently lives inside `CommentThread`.
- **Two body modes** (state in the Controller): `"list"` (default) and `"compose"`.
  - **list:** the comment list (`CommentThread` reduced to just the threaded cards — its outer `<aside>`/header move to `Panel`).
  - **compose:** the inline `Composer` (below).
- **`ConnectButton`** moves into the `Panel` header; the floating `fixed right-[352px]` wrapper is removed.

### 4. `Composer.tsx` — Dialog → inline form

- Remove `Dialog`/`Portal`/`Backdrop` and the `container` prop. Render the form directly inside the `Panel` body when `mode === "compose"`:
  - the selection quote (`spanExact`, amber left-border, italic),
  - the body `<textarea>`,
  - **collapsible** on-chain detail (`<details>` "▸ オンチェーン記録の詳細 (EAS)") — the field `dl` + schema link, collapsed by default so it doesn't dominate the narrow panel,
  - error line,
  - actions: **"Sepolia に公開"** (connected) / **"接続して公開"** (not connected).

### 5. Authoring trigger

- `SelectionPopover` ("💬 Comment") still appears on text selection **while the panel is open** (authoring is Stage-2-only — selection logic lives in the Controller, which exists only when the panel is mounted; this matches today's embed and keeps Stage 1 light). Clicking it sets `mode = "compose"` with `buildAnnoFields(...)`.
- Publish → `attestComment(...)` → on success `display.refresh()` + `setComments(display.projected())` + `mode = "list"`.
- `← back` returns to list without publishing.

### 6. i18n (`comments/i18n.ts`)

Add `ct()` strings: back-to-list, "write a comment…", on-chain details summary, publish/connect labels (EN + JA), reusing the existing table pattern.

## Interaction flows

- **Load:** button = `[💬(off, slashed) | {count}]`; highlights hidden (D1). Count invites opening.
- **Tap 💬:** highlights paint (amber underlines), cell-1 lights; persisted. Tap again → hidden. Works without opening the panel.
- **Tap count:** panel opens (Stage 2) in list mode; wallet + comments shown.
- **Author:** (panel open) select text → `💬 Comment` popover → compose mode → write → Publish → back to list with the new comment.
- **Focus:** click a list card or an underlined span → scroll + `comment-focus` wash (works even if `comment` highlights are toggled off, since `focus` paints its own highlight).

## Edge cases

- Highlights OFF + panel open: list still renders (projection decoupled); underlines stay hidden; toggling 💬 repaints live.
- Selecting text with the panel closed: no popover (authoring needs the panel open) — documented, not a regression.
- `localStorage` unavailable (private mode): fall back to the D1 default in-memory; never throw.
- Custom Highlight API unsupported: `applyHighlights` already no-ops; the toggle still flips state harmlessly.

## Out of scope

- Stage-1 selection/authoring (keep the loader light).
- The deferred Stage-3 chunk split (lazy eas-sdk on publish).
- Multi-select / reply composing changes; RTL; theming beyond the existing dark-mode.

## Files affected

`commentary/widget/src/loader.ts` (2-cell button + toggle + persistence) · `display.ts` (project/paint split) · `app.tsx` (panel mode state, wallet→header, selection→compose) · `comments/Composer.tsx` (Dialog→inline + collapsible details) · `comments/CommentThread.tsx` (reduce to list; chrome → Panel) · new `comments/Panel.tsx` (panel shell) · `comments/i18n.ts` (strings).

## Testing

- **Unit (vitest/jsdom):** `display.ts` — after `refresh()`, `projected()` is non-empty with `visible=false`; `setVisible(true)` registers the `comment` highlight; `setVisible(false)` clears it without losing `projected()`.
- **Runtime (browser, human):** button 2-cell toggle + persistence across reload; default-OFF on first load; count vs list; select→compose→publish (mock); wallet in header; focus/jump both directions.
