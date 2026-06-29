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

## Setup

```bash
git clone --recursive https://github.com/<owner>/ef-mandate-localize-web
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
