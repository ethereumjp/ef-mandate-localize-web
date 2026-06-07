# EF Mandate — Commentary Site

A reading website with an on‑chain commentary layer. It is kept here under `site/` as a **separate project** from the translation sources in `../source/`.

## What it does

- Language toggle (EN / JA, more later), with the UI chrome localized to the selected language
- Commentary on/off
- Wallet‑authenticated commentary on any text span, recorded as **EAS** attestations, with anchoring that survives edits to the original and translations
- Delivery via **GitHub Pages** (`config.json`) or **IPFS + ENS `contenthash`**

## Design

- [`docs/specs/2026-06-07-onchain-commentary-design.md`](docs/specs/2026-06-07-onchain-commentary-design.md)

## Status

Demo (work in progress) on branch `feat/commentary` — Sepolia for the demo, Ethereum mainnet for production.

## Stack

Astro · Tailwind CSS · Base UI (headless) · wagmi (+ viem) · ethers v6 (via wagmi's adapter) · `@ethereum-attestation-service/eas-sdk` · EAS GraphQL. Fully static, no backend.

## Content pipeline (M1)

Run from `site/`:

- `pnpm run blocks:inject` — inject/normalize `<!-- block: NN-pM -->` markers in the
  configured sources. English (`source/en`) is the id authority; translations mirror EN
  ids by position. Idempotent.
- `pnpm run blocks:check` — validate that every block has a unique marker and that each
  translation's id set matches English (used in CI).
- `pnpm run anchors:build` — emit `anchors/<lang>.json` (`blockId -> { order, text,
  blockHash }`) for the runtime re-anchoring layer. Output is gitignored.
- `pnpm test` — unit tests for normalization, hashing, parsing, ids, injection, checks,
  anchors.

Sources are declared in `config.json`. Markers are invisible in Markdown renderers and are
stripped from the merged manuscript by `scripts/build.py`.

Localization is ongoing: a translation chapter is aligned only once its block count
matches English. Chapters that don't yet match (untranslated stubs or mid-edit) are
reported as **pending** and skipped by `blocks:inject`, `blocks:check`, and `anchors:build`
— they never fail CI.

## Reading site (M2)

Run from `site/`:

- `pnpm dev` — local dev server (Astro).
- `pnpm build` — static build to `dist/` (a single page with all chapters and a jump-link index).
- `pnpm preview` — preview the built site.
- `pnpm run check:astro` — type-check `.astro` files.

The reading view renders each block in both languages (`data-block-id`, `.lang-en` /
`.lang-ja`); a small script flips `data-lang` / `data-comments` on `<html>` (saved in
`localStorage`), so toggling language is instant and keeps your place. Chapters without a
complete Japanese translation fall back to English with a notice. UI strings live in
`src/lib/i18n.ts`.

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
