# Widget Terminal Cobalt Theme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the commentary widget into a fixed `#0C0CFF`-on-white, square-cornered, monospace "terminal" identity — dropping host-adaptive accent, amber, and dark mode.

**Architecture:** Define one shared Tailwind color token (`cobalt`) plus a recessed gray surface token in `app.css`; swap every `stone`/`amber`/`--commentary-accent` usage in the React components for `cobalt` + opacity; rewrite the loader's inline launcher/popover styles and the document-global highlight CSS with literal `#0c0cff`. Remove the now-dead accent plumbing in `config.ts`.

**Tech Stack:** TypeScript, React 19, Tailwind CSS v4 (`@tailwindcss/vite`, `@theme` tokens), Vite, Vitest. pnpm workspace rooted at `commentary/`.

**Verification note:** This is a visual change. Most tasks cannot be unit-tested (red/green TDD); their verification is `typecheck` + `build` + an eyeball. The one task with real unit tests is the `config.ts` cleanup (Task 2) — its test file is updated/removed there. A final manual dogfood pass (Task 11) confirms the look end-to-end.

**Run commands from the `commentary/` workspace root:**
- Typecheck: `pnpm --filter @commentary/widget typecheck`
- Test: `pnpm --filter @commentary/widget test`
- Build: `pnpm --filter @commentary/widget build`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `widget/src/app.css` | Tailwind entry + theme tokens | Add `@theme` `cobalt` + `surface` colors |
| `widget/src/config.ts` | Embed config parsing | Remove accent field + `normalizeHex` + `accentForeground` |
| `widget/test/config.test.ts` | Config unit tests | Delete (only tested the removed fns) |
| `widget/src/loader.ts` | Stage-1 launcher + selection popover (inline styles) | Outline cobalt, square, mono; remove accent injection |
| `widget/src/web3/highlight.ts` | Document-global `::highlight()` CSS | amber → cobalt; drop dark branch |
| `widget/src/comments/Composer.tsx` | Compose form | Token swap, square, uppercase button |
| `widget/src/comments/CommentCard.tsx` | Comment + replies | Token swap, square, cobalt left bar |
| `widget/src/comments/Panel.tsx` | Sidebar shell | Token swap, square, `font-mono` root, `▸`/`[n]` |
| `widget/src/comments/ConnectButton.tsx` | Wallet control | Outline cobalt, uppercase action states |
| `widget/src/comments/AnchorStatusBadge.tsx` | Status pill | Outline cobalt tints |
| `widget/src/comments/CommentThread.tsx` | List + empty state | Empty-state text → cobalt |

---

### Task 1: Theme tokens in `app.css`

**Files:**
- Modify: `widget/src/app.css`

- [ ] **Step 1: Add the tokens**

Replace the entire file contents:

```css
@import "tailwindcss";
```

with:

```css
@import "tailwindcss";

/* Terminal Cobalt theme — one accent color + one recessed surface gray. */
@theme {
  --color-cobalt: #0c0cff;
  --color-surface: #eef0f3;
}
```

This registers `cobalt` and `surface` as Tailwind colors, so `text-cobalt`, `border-cobalt/30`, `bg-surface`, etc. (with opacity modifiers) all generate.

- [ ] **Step 2: Verify the build accepts the token**

Run: `pnpm --filter @commentary/widget build`
Expected: build succeeds (no Tailwind/CSS error).

- [ ] **Step 3: Commit**

```bash
git add commentary/widget/src/app.css
git commit -m "style(widget): add cobalt + surface theme tokens"
```

---

### Task 2: Remove accent plumbing from `config.ts`

**Files:**
- Modify: `widget/src/config.ts`
- Delete: `widget/test/config.test.ts`

- [ ] **Step 1: Confirm `normalizeHex` / `accentForeground` have no other consumers**

Run: `grep -rn "normalizeHex\|accentForeground" commentary/widget/src`
Expected: matches only in `src/config.ts` (definitions + the `accent:` line in `readConfig`) and `src/loader.ts` (the import — removed in Task 3). If any OTHER file appears, stop and reconcile before deleting.

- [ ] **Step 2: Remove the `accent` field from `WidgetConfig`**

Delete these two lines (config.ts:9-10):

```ts
  /** Brand accent for the launcher + publish button (`data-accent`). `#rrggbb`, or undefined to keep the default monochrome. */
  accent?: string;
```

- [ ] **Step 3: Remove `normalizeHex` and `accentForeground`**

Delete the whole block config.ts:14-40 (both functions and their doc comments):

```ts
/** Validate + normalize a `data-accent` value to `#rrggbb` (lowercase); null if unusable. */
export function normalizeHex(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return undefined;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  return `#${hex}`;
}

/** Pick a readable foreground (near-black or white) for an accent, by WCAG contrast. */
export function accentForeground(hex: string): string {
  const c = normalizeHex(hex);
  if (!c) return "#ffffff";
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(parseInt(c.slice(1, 3), 16));
  const g = lin(parseInt(c.slice(3, 5), 16));
  const b = lin(parseInt(c.slice(5, 7), 16));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast ratio against white vs. near-black; keep whichever is higher.
  const onBlack = (L + 0.05) / 0.05;
  const onWhite = 1.05 / (L + 0.05);
  return onBlack >= onWhite ? "#1c1917" : "#ffffff";
}
```

- [ ] **Step 4: Drop the `accent` line in `readConfig`**

Delete this line (config.ts:65):

```ts
    accent: normalizeHex(d.accent),
```

- [ ] **Step 5: Delete the obsolete test file**

```bash
git rm commentary/widget/test/config.test.ts
```

(The file only tested `normalizeHex` and `accentForeground`, both now removed. It is currently untracked; if `git rm` errors, use `rm commentary/widget/test/config.test.ts`.)

- [ ] **Step 6: Verify typecheck + test suite are clean**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: PASS (no reference to removed symbols).

Run: `pnpm --filter @commentary/widget test`
Expected: PASS (or "no test files" if config.test.ts was the only suite — both are acceptable).

- [ ] **Step 7: Commit**

```bash
git add commentary/widget/src/config.ts
git commit -m "refactor(widget): drop data-accent plumbing"
```

---

### Task 3: Loader launcher + popover (`loader.ts`)

**Files:**
- Modify: `widget/src/loader.ts`

- [ ] **Step 1: Drop the `accentForeground` import**

Change loader.ts:7:

```ts
import { readConfig, accentForeground } from "./config";
```

to:

```ts
import { readConfig } from "./config";
```

- [ ] **Step 2: Remove the accent CSS-variable injection**

Replace loader.ts:30-36:

```ts
  // Brand accent: set once on the host so it inherits across the shadow boundary
  // into both the inline launcher and the lazy-loaded React panel. Unset => the
  // `var(..., <fallback>)` defaults below keep the original monochrome look.
  if (config.accent) {
    host.style.setProperty("--commentary-accent", config.accent);
    host.style.setProperty("--commentary-accent-fg", accentForeground(config.accent));
  }
  document.body.appendChild(host);
```

with:

```ts
  document.body.appendChild(host);
```

- [ ] **Step 3: Restyle the launcher button (outline cobalt, square, mono)**

Replace loader.ts:43-46:

```ts
  button.style.cssText =
    `position:fixed;bottom:20px;${side};z-index:2147483646;display:inline-flex;align-items:center;gap:6px;` +
    "padding:11px 15px;background:var(--commentary-accent,#1c1917);color:var(--commentary-accent-fg,#fff);" +
    "border:1px solid rgba(255,255,255,0.1);border-radius:9999px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2)";
```

with:

```ts
  button.style.cssText =
    `position:fixed;bottom:20px;${side};z-index:2147483646;display:inline-flex;align-items:center;gap:6px;` +
    "padding:10px 14px;background:#fff;color:#0c0cff;border:1px solid #0c0cff;border-radius:0;cursor:pointer;" +
    "font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:4px 4px 0 rgba(12,12,255,.12)";
```

- [ ] **Step 4: Restyle the selection popover**

Replace loader.ts:52-56:

```ts
  popover.style.cssText =
    "position:fixed;z-index:2147483646;display:none;align-items:center;gap:6px;" +
    "padding:7px 12px;background:var(--commentary-accent,#1c1917);color:var(--commentary-accent-fg,#fff);" +
    "border:1px solid rgba(255,255,255,0.1);border-radius:9999px;cursor:pointer;" +
    "box-shadow:0 4px 16px rgba(0,0,0,.2);font:500 12px/1 system-ui";
```

with:

```ts
  popover.style.cssText =
    "position:fixed;z-index:2147483646;display:none;align-items:center;gap:6px;" +
    "padding:6px 11px;background:#fff;color:#0c0cff;border:1px solid #0c0cff;border-radius:0;cursor:pointer;" +
    "box-shadow:4px 4px 0 rgba(12,12,255,.12);font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace";
```

- [ ] **Step 5: Update the open-state (✕) padding**

In `renderButton`, replace loader.ts:75-76:

```ts
      // Open → a clear close (✕) button. Equal padding → square → perfect circle.
      button.style.padding = "11px";
```

with:

```ts
      // Open → a square close (✕) button. The ✕ svg uses stroke:currentColor → cobalt.
      button.style.padding = "10px";
```

(The ✕ svg already uses `stroke="currentColor"`, so it inherits the button's `#0c0cff` — no change to that line.)

- [ ] **Step 6: Restyle the closed-state icon + count (cobalt, bracketed count)**

Replace loader.ts:79-85:

```ts
      // Closed → comment bubble + count (a pill). Muted by default; tracks the
      // accent foreground when a brand accent is set.
      button.style.padding = "11px 15px";
      button.innerHTML =
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--commentary-accent-fg,#d6d3d1)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${PENCIL}</svg>` +
        `<span style="font:500 11px/1 system-ui;color:var(--commentary-accent-fg,#a8a29e)">${display.count()}</span>`;
```

with:

```ts
      // Closed → pencil icon + a bracketed count, all cobalt (count dimmed).
      button.style.padding = "10px 14px";
      button.innerHTML =
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0c0cff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${PENCIL}</svg>` +
        `<span style="font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0c0cff;opacity:.6">[${display.count()}]</span>`;
```

- [ ] **Step 7: Verify typecheck + build**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: PASS.

Run: `pnpm --filter @commentary/widget build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add commentary/widget/src/loader.ts
git commit -m "style(widget): outline-cobalt terminal launcher + popover"
```

---

### Task 4: Highlight colors (`web3/highlight.ts`)

**Files:**
- Modify: `widget/src/web3/highlight.ts`

- [ ] **Step 1: Recolor + drop the dark branch**

Replace highlight.ts:50-60:

```ts
// Comment-span highlight styling. The Custom Highlight API registry AND its
// ::highlight() rules are DOCUMENT-global — a shadow-root stylesheet can't reach
// highlighted ranges — so the rule must live in document.head. Literal colours
// (Tailwind amber-100/200), not CSS vars, so highlights render on any host page;
// the dark-mode focus wash still honours a host's [data-theme="dark"] if present.
const HIGHLIGHT_STYLE_ID = "commentary-highlight-styles";
const HIGHLIGHT_CSS = `
::highlight(comment){text-decoration-line:underline;text-decoration-color:#fde68a;text-decoration-thickness:2px;text-underline-offset:3px}
::highlight(comment-focus){background-color:#fef3c7;text-decoration-line:underline;text-decoration-color:#fde68a;text-decoration-thickness:2px;text-underline-offset:3px}
[data-theme="dark"] ::highlight(comment-focus){background-color:color-mix(in oklab,#fde68a 35%,transparent);text-decoration-color:#fde68a}
`;
```

with:

```ts
// Comment-span highlight styling. The Custom Highlight API registry AND its
// ::highlight() rules are DOCUMENT-global — a shadow-root stylesheet can't reach
// highlighted ranges — so the rule must live in document.head. Literal cobalt
// (#0c0cff), not CSS vars, so highlights render identically on any host page.
// Light-only: the focus wash is a faint cobalt tint regardless of host theme.
const HIGHLIGHT_STYLE_ID = "commentary-highlight-styles";
const HIGHLIGHT_CSS = `
::highlight(comment){text-decoration-line:underline;text-decoration-color:#0c0cff;text-decoration-thickness:2px;text-underline-offset:3px}
::highlight(comment-focus){background-color:rgba(12,12,255,.10);text-decoration-line:underline;text-decoration-color:#0c0cff;text-decoration-thickness:2px;text-underline-offset:3px}
`;
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add commentary/widget/src/web3/highlight.ts
git commit -m "style(widget): cobalt comment highlights, drop dark wash"
```

---

### Task 5: Composer (`comments/Composer.tsx`)

**Files:**
- Modify: `widget/src/comments/Composer.tsx`

- [ ] **Step 1: Recolor the label**

Replace Composer.tsx:34:

```tsx
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
```

with:

```tsx
      <p className="text-xs font-semibold uppercase tracking-wider text-cobalt/50">
```

- [ ] **Step 2: Recolor the quoted blockquote**

Replace Composer.tsx:38:

```tsx
        <blockquote className="mt-2 border-l-2 border-amber-300 pl-2 text-xs italic leading-snug text-stone-500 dark:border-amber-500/60 dark:text-stone-400">
```

with:

```tsx
        <blockquote className="mt-2 border-l-2 border-cobalt/40 pl-2 text-xs italic leading-snug text-cobalt/65">
```

- [ ] **Step 3: Recolor the textarea (square, gray surface, cobalt text/placeholder)**

Replace Composer.tsx:43:

```tsx
        className="mt-3 h-28 w-full rounded border border-stone-300 bg-transparent p-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700"
```

with:

```tsx
        className="mt-3 h-28 w-full border border-cobalt/40 bg-surface p-2 text-sm text-cobalt placeholder:text-cobalt/40 disabled:cursor-not-allowed disabled:opacity-50"
```

- [ ] **Step 4: Recolor the error line (single-color: cobalt + `!` marker)**

Replace Composer.tsx:50:

```tsx
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
```

with:

```tsx
      {error ? <p className="mt-2 text-xs font-semibold text-cobalt">! {error}</p> : null}
```

- [ ] **Step 5: Recolor the details / dl / schema link**

Replace Composer.tsx:52:

```tsx
        <details className="mt-3 text-xs text-stone-400 dark:text-stone-500">
```

with:

```tsx
        <details className="mt-3 text-xs text-cobalt/50">
```

Replace Composer.tsx:56:

```tsx
          <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-2 border-t border-stone-100 pt-2 font-mono dark:border-stone-800">
```

with:

```tsx
          <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-2 border-t border-cobalt/15 pt-2 font-mono">
```

Replace Composer.tsx:91:

```tsx
              className="mt-1 inline-block underline hover:text-stone-600 dark:hover:text-stone-300"
```

with:

```tsx
              className="mt-1 inline-block underline hover:text-cobalt"
```

- [ ] **Step 6: Restyle both buttons (outline cobalt, square, uppercase)**

Replace Composer.tsx:102 (the connected/publish button):

```tsx
            className="rounded-full w-full bg-[var(--commentary-accent,#1c1917)] px-3 py-1 text-sm text-[var(--commentary-accent-fg,#fff)] disabled:opacity-50 dark:bg-[var(--commentary-accent,#f5f5f4)] dark:text-[var(--commentary-accent-fg,#1c1917)]"
```

with:

```tsx
            className="w-full border border-cobalt bg-white px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-cobalt hover:bg-surface disabled:opacity-50"
```

Replace Composer.tsx:111 (the connect button):

```tsx
            className="rounded-full w-full bg-[var(--commentary-accent,#1c1917)] px-3 py-1 text-sm text-[var(--commentary-accent-fg,#fff)] dark:bg-[var(--commentary-accent,#f5f5f4)] dark:text-[var(--commentary-accent-fg,#1c1917)]"
```

with:

```tsx
            className="w-full border border-cobalt bg-white px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-cobalt hover:bg-surface"
```

- [ ] **Step 7: Verify typecheck**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add commentary/widget/src/comments/Composer.tsx
git commit -m "style(widget): cobalt terminal composer"
```

---

### Task 6: Comment card (`comments/CommentCard.tsx`)

**Files:**
- Modify: `widget/src/comments/CommentCard.tsx`

- [ ] **Step 1: Recolor the card container (square, cobalt left bar)**

Replace CommentCard.tsx:37-45:

```tsx
      className={
        depth > 0
          ? "mt-3 border-l border-stone-200 pl-3 dark:border-stone-700"
          : `cursor-pointer rounded-r border-l-3 px-3.5 py-4 transition-colors ${
              focused
                ? "border-stone-400 bg-stone-100/70 dark:border-stone-500 dark:bg-stone-800/60"
                : "border-transparent hover:bg-stone-50 dark:hover:bg-stone-800/40"
            }`
      }
```

with:

```tsx
      className={
        depth > 0
          ? "mt-3 border-l border-cobalt/30 pl-3"
          : `cursor-pointer border-l-3 px-3.5 py-4 transition-colors ${
              focused
                ? "border-cobalt bg-surface"
                : "border-cobalt/40 hover:bg-surface"
            }`
      }
```

- [ ] **Step 2: Recolor the quoted blockquote**

Replace CommentCard.tsx:48:

```tsx
        <blockquote className="line-clamp-1 border-l border-amber-300/80 pl-2 text-xs leading-snug text-stone-400 dark:border-amber-500/50 dark:text-stone-500">
```

with:

```tsx
        <blockquote className="line-clamp-1 border-l border-cobalt/40 pl-2 text-xs leading-snug text-cobalt/45">
```

- [ ] **Step 3: Recolor body + meta**

Replace CommentCard.tsx:52:

```tsx
      <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-stone-700 dark:text-stone-200">
```

with:

```tsx
      <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-cobalt">
```

Replace CommentCard.tsx:55:

```tsx
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
```

with:

```tsx
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-cobalt/45">
```

- [ ] **Step 4: Recolor pastVersion + pending dot**

Replace CommentCard.tsx:60:

```tsx
          <span className="text-amber-600 dark:text-amber-400">{ct(lang, "pastVersion")}</span>
```

with:

```tsx
          <span className="text-cobalt/70">{ct(lang, "pastVersion")}</span>
```

Replace CommentCard.tsx:63-66:

```tsx
          <span
            aria-hidden
            className="inline-block size-1.5 animate-pulse rounded-full bg-amber-500"
          />
```

with:

```tsx
          <span
            aria-hidden
            className="inline-block size-1.5 animate-pulse bg-cobalt"
          />
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add commentary/widget/src/comments/CommentCard.tsx
git commit -m "style(widget): cobalt terminal comment card"
```

---

### Task 7: Panel shell (`comments/Panel.tsx`)

**Files:**
- Modify: `widget/src/comments/Panel.tsx`

- [ ] **Step 1: Recolor the aside (square, mono root, flat cobalt shadow)**

Replace Panel.tsx:21:

```tsx
    <aside className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col overflow-hidden rounded-t-2xl border-t border-stone-200 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.25)] dark:border-stone-700 dark:bg-stone-900 sm:inset-x-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[340px] sm:rounded-none sm:border-t-0 sm:border-l sm:shadow-[-14px_0_44px_rgba(0,0,0,0.18)]">
```

with:

```tsx
    <aside className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col overflow-hidden border-t border-cobalt/40 bg-white font-mono shadow-[0_-8px_30px_rgba(12,12,255,0.12)] sm:inset-x-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[340px] sm:border-t-0 sm:border-l sm:shadow-[-6px_0_0_rgba(12,12,255,0.10)]">
```

- [ ] **Step 2: Recolor the header row**

Replace Panel.tsx:22:

```tsx
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-2.5 dark:border-stone-700">
```

with:

```tsx
      <div className="flex items-center justify-between gap-2 border-b border-cobalt/30 px-3 py-2.5">
```

- [ ] **Step 3: Recolor the back button**

Replace Panel.tsx:27:

```tsx
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
```

with:

```tsx
            className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-cobalt hover:bg-surface"
```

- [ ] **Step 4: Recolor the title + bracketed count, add `▸` prefix**

Replace Panel.tsx:32-39:

```tsx
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {ct(lang, "threadTitle")}
            {count > 0 ? (
              <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">
                {count}
              </span>
            ) : null}
          </h2>
```

with:

```tsx
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-cobalt">
            <span aria-hidden="true">▸ </span>
            {ct(lang, "threadTitle")}
            {count > 0 ? (
              <span className="ml-1.5 font-normal text-cobalt/60">[{count}]</span>
            ) : null}
          </h2>
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add commentary/widget/src/comments/Panel.tsx
git commit -m "style(widget): cobalt terminal panel shell"
```

---

### Task 8: Connect button (`comments/ConnectButton.tsx`)

**Files:**
- Modify: `widget/src/comments/ConnectButton.tsx`

- [ ] **Step 1: Replace the shared class string with base + action variants**

Replace ConnectButton.tsx:10-11:

```tsx
const cls =
  "rounded h-8 max-w-[12rem] truncate border border-stone-300 px-2 py-1 text-sm text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800";
```

with:

```tsx
// Outline cobalt, square. Action states (connect/switch) are uppercased; the
// connected state shows an address/ENS name, which must NOT be uppercased.
const base =
  "h-8 max-w-[12rem] truncate border border-cobalt px-2 py-1 text-sm text-cobalt hover:bg-surface";
const action = `${base} uppercase tracking-wider`;
```

- [ ] **Step 2: Use `action` for the connect state**

Replace ConnectButton.tsx:24-26:

```tsx
      <button
        className={cls}
        disabled={isPending}
```

with:

```tsx
      <button
        className={action}
        disabled={isPending}
```

- [ ] **Step 3: Use `action` for the switch-chain state**

Replace ConnectButton.tsx:35:

```tsx
      <button className={cls} onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}>
```

with:

```tsx
      <button className={action} onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}>
```

- [ ] **Step 4: Use `base` for the connected (address/ENS) state**

Replace ConnectButton.tsx:41:

```tsx
    <button className={cls} title="Disconnect" onClick={() => disconnect()}>
```

with:

```tsx
    <button className={base} title="Disconnect" onClick={() => disconnect()}>
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add commentary/widget/src/comments/ConnectButton.tsx
git commit -m "style(widget): cobalt outline connect button"
```

---

### Task 9: Status badge + empty state

**Files:**
- Modify: `widget/src/comments/AnchorStatusBadge.tsx`
- Modify: `widget/src/comments/CommentThread.tsx`

- [ ] **Step 1: Recolor the status badge (outline cobalt, square)**

Replace AnchorStatusBadge.tsx:12-16:

```tsx
  const tone =
    status === "orphaned"
      ? "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  return <span className={`rounded px-1.5 py-0.5 text-xs ${tone}`}>{label}</span>;
```

with:

```tsx
  const tone =
    status === "orphaned"
      ? "border border-cobalt/30 text-cobalt/60"
      : "border border-cobalt text-cobalt";
  return <span className={`px-1.5 py-0.5 text-xs ${tone}`}>{label}</span>;
```

- [ ] **Step 2: Recolor the empty-state text**

Replace CommentThread.tsx (the empty-state `<p>`):

```tsx
        <p className="px-2 py-6 text-center text-sm text-stone-400">{ct(lang, "noComments")}</p>
```

with:

```tsx
        <p className="px-2 py-6 text-center text-sm text-cobalt/45">{ct(lang, "noComments")}</p>
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add commentary/widget/src/comments/AnchorStatusBadge.tsx commentary/widget/src/comments/CommentThread.tsx
git commit -m "style(widget): cobalt status badge + empty state"
```

---

### Task 10: Sweep for leftover stone/amber/accent

**Files:** (read-only verification)

- [ ] **Step 1: Confirm no stray legacy tokens remain**

Run: `grep -rn "stone-\|amber-\|commentary-accent\|red-600\|dark:" commentary/widget/src`
Expected: NO matches. If any appear, recolor them to the cobalt/surface equivalents following the patterns above and re-run.

- [ ] **Step 2: Full typecheck + test + build**

Run: `pnpm --filter @commentary/widget typecheck`
Expected: PASS.

Run: `pnpm --filter @commentary/widget test`
Expected: PASS (or no test files).

Run: `pnpm --filter @commentary/widget build`
Expected: PASS.

- [ ] **Step 3: Commit (only if Step 1 required fixes)**

```bash
git add commentary/widget/src
git commit -m "style(widget): finish cobalt token sweep"
```

---

### Task 11: Manual dogfood

**Files:** none (verification only)

- [ ] **Step 1: Serve the built widget and load it with mock data**

Run (from `commentary/widget/`): `pnpm build && pnpm serve:test`
Then open the test harness page (the `test/` HTML that loads `embed.js` with `data-mock="1"`) in a browser. If no harness page exists, load the demo the repo normally uses for the widget.

- [ ] **Step 2: Eyeball against the approved mockup**

Confirm visually:
- Launcher is a white square pill with a cobalt border + pencil icon + `[n]` count; hard cobalt shadow; no rounded corners.
- Selecting text shows the white/cobalt outline "✎ Comment" popover (square).
- Panel: white, cobalt hairline borders, `▸ <title> [n]` header, monospace throughout, no rounded corners.
- A comment card: cobalt left bar, cobalt body text, dimmed (opacity) quote + meta; focus/hover shows the light gray `surface` background.
- Composer: gray textarea, cobalt placeholder, `PUBLISH` / connect button as a cobalt outline, uppercase.
- Highlights on the page underline in cobalt; focused highlight has a faint cobalt wash.
- No amber, no gray text, no dark-mode flip when the OS is in dark mode.

- [ ] **Step 3: Note the result**

If everything matches, the theme is complete. Record any visual gaps and loop back to the relevant task.

---

## Self-Review

**Spec coverage:**
- `#0C0CFF` single color + opacity hierarchy → Task 1 (token) + every component task uses `text-cobalt`, `/45`, `/50`, `/60`, `/65`, `/70`. ✓
- Gray only as light surface bg → `surface` token (Task 1), used as `bg-surface` for textarea/hover/focus only; no `text-surface`. ✓
- Retire `data-accent` → Tasks 2 (config) + 3 (loader). ✓
- Retire amber → Tasks 4–6, 9. ✓
- Square corners (no `rounded-*`) → removed in Tasks 3, 5, 6, 7, 8, 9; swept in Task 10. ✓
- Monospace → loader inline (Task 3) + `font-mono` on Panel root cascades to all children (Task 7). ✓
- Outline buttons + UPPERCASE actions → Tasks 5, 8. ✓
- Light mode only (drop `dark:`) → removed per file; swept in Task 10. ✓
- Terminal affordances (`▸`, `[n]`, count brackets) → Tasks 3, 7. ✓

**Placeholder scan:** No TBD/TODO; every code step shows exact before/after strings. ✓

**Type consistency:** `cobalt`/`surface` token names are used identically across all tasks. ConnectButton renames `cls` → `base`/`action` and updates all three call sites (Steps 2–4). No new functions/types introduced. ✓

**Deliberate spec interpretations to confirm during review:**
- Error text (was `red-600`) → cobalt + bold + `!` prefix, honoring the single-color rule (Task 5 Step 4).
- Comment cards get an always-on cobalt left bar (matching the mockup), not only on focus.
