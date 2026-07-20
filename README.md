# EF Mandate localize web

Monorepo for the **EF Mandate localize web** and its **embeddable on-chain annotation
widget**. The English/Japanese localization markdown is consumed from the upstream content
repo [`ethereumjp/ef-mandate-localize-jp`](https://github.com/ethereumjp/ef-mandate-localize-jp)
as the `localize/` git submodule (source of truth — translations are edited upstream).

## Layout

- `apps/web` — `ef-mandate-localize-web`: the Astro reading site with an on-chain
  annotation layer.
- `packages/core` — `@anno/core`: shared anchoring, EAS, and schema logic.
- `packages/widget` — `@anno/widget`: the standalone embeddable annotation widget
  ([README](packages/widget/README.md)).
- `localize/` — git submodule: upstream localization markdown.
- `docs/` — design specs, implementation plans, demo checklists.

## Deployments

| What | Where |
|---|---|
| **Website** (IPFS/IPNS) | IPNS: `k51qzi5uqu5dmii96jk04kp35fa5xngwevo7ja3vjthgpc06ysymba0shinvbi` — [open via inbrowser.link](https://k51qzi5uqu5dmii96jk04kp35fa5xngwevo7ja3vjthgpc06ysymba0shinvbi.ipns.inbrowser.link) (trustless in-browser gateway) |
| **Annotation schema** (EAS) | UID `0xc12b39c75a5d08a325d6b246ad3ff622c2ade9f4198b9c63ddcec472ac695a04` — [Mainnet](https://easscan.org/schema/view/0xc12b39c75a5d08a325d6b246ad3ff622c2ade9f4198b9c63ddcec472ac695a04) (not yet registered — pending `anno:schema:register`; the UID is derived from the schema, so it is known in advance) · [Sepolia](https://sepolia.easscan.org/schema/view/0xc12b39c75a5d08a325d6b246ad3ff622c2ade9f4198b9c63ddcec472ac695a04) |
| **Widget embed** (third-party sites) | [`https://cdn.jsdelivr.net/gh/ethereumjp/ef-mandate-localize-web@widget-release/packages/widget/dist/embed.js`](https://cdn.jsdelivr.net/gh/ethereumjp/ef-mandate-localize-web@widget-release/packages/widget/dist/embed.js) (served from the `widget-release` branch; the site itself bundles the widget same-origin) |

## Setup

```bash
git clone --recursive https://github.com/ethereumjp/ef-mandate-localize-web
# or, in an existing clone:
git submodule update --init
pnpm install
```

## Develop

```bash
pnpm run dev:web:mock   # site with bundled mock comments
pnpm run build:web      # static site → apps/web/dist
pnpm run build:widget    # embed bundle → packages/widget/dist/embed.js
pnpm -r test
pnpm -r typecheck
```

## Updating the localization

Localization is pinned via the `localize/` submodule. To pull the latest upstream content:

```bash
git -C localize pull origin main
git add localize && git commit -m "chore: bump localize submodule"
```
