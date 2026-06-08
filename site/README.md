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
- `pnpm build` — static build to `dist/`: English at `/`, Japanese at `/ja`, each a single page with all chapters and a jump-link index.
- `pnpm preview` — preview the built site.
- `pnpm run check:astro` — type-check `.astro` files.

The site has two routes — English at `/` and Japanese at `/ja`; each renders a single
language (Japanese chapters not yet translated fall back to English with a notice). The
toolbar's EN / 日本語 links carry the current section hash so you keep your place when
switching, and a small script persists the commentary on/off toggle in `localStorage`.
UI strings live in `src/lib/i18n.ts`.

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

## Commenting (M4)

### What it is

Reader comments are **EAS attestations published on Sepolia** (Ethereum mainnet for production). Each comment is anchored to the exact text span the reader selects — using the same rendered-text anchoring system built in M1/M3 (`makeAnchor` / `project`). The UI is a client-only React island (`client:only="react"`) that is gated by the existing Comments on/off toggle in the toolbar; it has no server component and produces no SSR output.

When a reader selects text in a chapter block, a popover offers a 💬 button. Clicking it opens the Composer, where the reader writes a comment. Pressing **Publish** asks the connected wallet (MetaMask/Rabby on Sepolia) to sign the attestation transaction. The comment badge appears immediately (optimistic), then resolves once the transaction confirms.

Reading existing attestations and projecting the comment gutter thread view is **M5**.

### Environment variables

| Variable | Required | When read | Notes |
|---|---|---|---|
| `PUBLIC_SEPOLIA_RPC_URL` | No | runtime | JSON-RPC endpoint; defaults to the public node in `.env.example` if unset |
| `PUBLIC_EAS_SCHEMA_UID` | **Yes (for attest path)** | **build time** | UID of the registered EAS schema. The attest code ships in every build; the submit path only *functions* when this was set at build time. If unset, the UI shows "Connect a wallet on Sepolia (and set PUBLIC_EAS_SCHEMA_UID)" and no transaction is attempted. |
| `SEPOLIA_PRIVATE_KEY` | Schema-register script only | `pnpm run schema:register` | A throwaway testnet key; **never commit**. Not read by the site. |

**Build-time note:** `PUBLIC_EAS_SCHEMA_UID` is baked in at `pnpm build` time (Astro static build). For a deployed or IPFS artifact (M6), set this variable in `.env` *before* running `pnpm build`. If you change `.env` after building, rebuild the artifact.

### One-time setup

1. **Wallet + testnet ETH** — Install MetaMask or Rabby and obtain Sepolia ETH from a faucet (e.g. `sepoliafaucet.com` or the Alchemy Sepolia faucet).
2. **Copy the env file** — `cp .env.example .env` (`.env` is gitignored).
3. **Register the schema** — Fund a throwaway Sepolia key, then run:
   ```
   SEPOLIA_PRIVATE_KEY=0x… PUBLIC_SEPOLIA_RPC_URL=https://… pnpm run schema:register
   ```
   Copy the printed UID and set it in `.env`:
   ```
   PUBLIC_EAS_SCHEMA_UID=0x<uid>
   ```
   Alternatively, register the same schema string at [easscan.org](https://sepolia.easscan.org) via the Sepolia SchemaRegistry UI and copy the resulting UID.
4. **Rebuild / start dev** — Run `pnpm dev` (or `pnpm build` for a static artifact). The attest path is now live.

### Manual demo checklist

See [`docs/m4-demo-checklist.md`](docs/m4-demo-checklist.md).
