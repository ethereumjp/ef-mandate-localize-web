# ef-mandate-localize-site

Monorepo for the **EF Mandate reading site** and its **embeddable on-chain commentary
widget**. The English/Japanese localization markdown is consumed from the upstream content
repo [`ethereumjp/ef-mandate-localize-jp`](https://github.com/ethereumjp/ef-mandate-localize-jp)
as the `localize/` git submodule (source of truth — translations are edited upstream).

## Layout

- `apps/site` — `ef-mandate-localize-site`: the Astro reading site with an on-chain
  commentary layer.
- `packages/core` — `@anno/core`: shared anchoring, EAS, and schema logic.
- `packages/widget` — `@anno/widget`: the standalone embeddable annotation widget
  ([README](packages/widget/README.md)).
- `localize/` — git submodule: upstream localization markdown.
- `docs/` — design specs, implementation plans, demo checklists.

## Setup

```bash
git clone --recursive https://github.com/<owner>/ef-mandate-localize-site
# or, in an existing clone:
git submodule update --init
pnpm install
```

## Develop

```bash
pnpm run dev:site:mock   # site with bundled mock comments
pnpm run build:site      # static site → apps/site/dist
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
