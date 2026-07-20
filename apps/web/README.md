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
- Custom RPCs are optional (`PUBLIC_MAINNET_RPC_URL`, `PUBLIC_SEPOLIA_RPC_URL`; public
  defaults otherwise).

## Networks & schema registration

The site defaults to **mainnet**. Append **`?mode=testnet`** to any page URL to use
**Sepolia** (demo / local dev) — one build serves both; the widget resolves the network
client-side (`@anno/core/chain`). Reads go through the network's EAS GraphQL endpoint (no
wallet/RPC needed); publishing a comment needs a wallet (MetaMask/Rabby) on the active
network.

Register the EAS schema **once per network** (the same schema string yields the same UID on
every chain; the widget ships this UID as its built-in default — registration is the only
per-chain step):

```bash
NETWORK=mainnet EAS_PRIVATE_KEY=0x… pnpm --filter ef-mandate-localize-web anno:schema:register
NETWORK=sepolia EAS_PRIVATE_KEY=0x… pnpm --filter ef-mandate-localize-web anno:schema:register
```

To register from a **Safe multisig** instead, run `anno:schema:calldata` (no key, no RPC) —
it prints the deterministic UID and the `register(...)` call (`to` / `data`) to submit from
the Safe's Transaction Builder. The UID is identical either way (EAS schema registration is
caller-independent, so the registrant address doesn't affect it):

```bash
NETWORK=mainnet pnpm --filter ef-mandate-localize-web anno:schema:calldata
```

## Operational scripts

- `anno:schema:register` / `anno:schema:calldata` — one-time EAS schema registration (per
  network), see above.
- `gen:mock` — regenerate the bundled mock comments.

Deploy: automated — pushes to `main` build the site (widget bundled same-origin) and
publish it to IPFS/IPNS; see [`.github/workflows/deploy-web.yml`](../../.github/workflows/deploy-web.yml)
and the [root README's Deployments table](../../README.md#deployments).

## Stack

Astro · Tailwind CSS · the `@anno/widget` island (React 19 · wagmi/viem · EAS GraphQL).
