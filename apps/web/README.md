# ef-mandate-localize-web

The Astro reading site for the EF Mandate localization, with an on-chain **annotation**
layer. One package in this monorepo — see the [root README](../../README.md) and
[`AGENTS.md`](../../AGENTS.md) for the full architecture.

## What it is

- Renders the EN / JA (more languages later) localization, consumed from the `localize/`
  git submodule (`config.json` points at its chapters). EN and JA are aligned **by
  position** — the pipeline is marker-free.
- Embeds the [`@anno/widget`](../../packages/widget) annotation widget as a built bundle
  (served from `public/annotation/`), so readers can attach wallet-signed comments anchored
  to the exact text span they select, recorded as **EAS** attestations with anchoring that
  survives edits to the source and translations.
- Fully static — no backend.

## Develop

Run from the repo **root** (preferred):

```bash
pnpm run dev:web:mock   # dev server with bundled mock comments (no wallet/chain)
pnpm run build:web      # static build → apps/web/dist
```

Or from `apps/web/`: `pnpm dev` / `pnpm build` / `pnpm preview`. `dev` and `build` first run
`embed:build`, which builds `@anno/widget` and copies its `dist/` into
`public/annotation/` (generated, gitignored — don't hand-edit it; change the widget and
rebuild).

## Configuration

- `config.json` — the localization sources (chapters in the `localize/` submodule).
- `PUBLIC_ANNO_WIDGET_URL` — where the page loads the widget bundle from, **baked in at build time**;
  empty → the same-origin copy from `embed:build`. (The schema UID is built into the widget.)
- `PUBLIC_MOCK_COMMENTS=1` — show bundled mock comments with no wallet/chain (what
  `dev:web:mock` sets). Use it for UI work.
- Network: **Sepolia** for the demo, Ethereum mainnet for production. Reads go through the
  EAS GraphQL API; publishing needs a wallet (MetaMask/Rabby).

## Operational scripts

- `anno:schema:register` — one-time EAS schema registration (per network).
- `gen:mock` — regenerate the bundled mock comments.

Deploy: see [`docs/deployment.md`](../../docs/deployment.md).

## Stack

Astro · Tailwind CSS · the `@anno/widget` island (React 19 · wagmi/viem · ethers v6 ·
`@ethereum-attestation-service/eas-sdk` · EAS GraphQL).
