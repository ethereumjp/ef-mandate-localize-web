# Monorepo Restructure — Design

**Date:** 2026-06-28
**Status:** Approved (design)

## Background

This repository began as a fork of `ethereumjp/ef-mandate-localize-jp` (the
canonical Japanese localization of the EF Mandate PDF). On the `feat/commentary`
branch, an on-chain commentary site + embeddable annotation widget was developed
as a **nested pnpm monorepo** under `commentary/`, alongside the localization
sources (`source/`, `scripts/build.py`, etc.) it was forked from.

This mixes two projects with different lifecycles and ownership in one tree:

1. **Localization content** — the EF Mandate translation markdown. Canonical home
   is upstream `ethereumjp/ef-mandate-localize-jp`. Built to PDF via Python/pandoc/TeX.
2. **The site + widget** — a reading site with an on-chain commentary layer, and a
   generic, reusable annotation widget that can be embedded on any site.

## Goal

Restructure this repository into a clean **pnpm monorepo for the site + widget**,
consuming the localization markdown as a **git submodule** from upstream. Keep the
two concerns separated: upstream = content, this repo = application.

- **Near term:** restructure in place on this repo (a branch).
- **Eventual home:** push to `ethereumjp/ef-mandate-localize-site` (pending owner
  approval). The repo and structure are named with that destination in mind.

## Premise (fixed)

- `ethereumjp/ef-mandate-localize-jp` (origin) = localization markdown (content repo).
- This repo = site + annotation widget.
- The localization markdown is pulled via **git submodule** and built into the site.

## Target structure

```
ef-mandate-localize-site/            # this repo (eventual: ethereumjp/ef-mandate-localize-site)
├── pnpm-workspace.yaml              # packages: ["apps/*", "packages/*"]
├── package.json                     # root scripts (test / typecheck / build / dev:site:mock)
├── pnpm-lock.yaml
├── .gitmodules                      # localize -> ethereumjp/ef-mandate-localize-jp
├── localize/                        # git submodule (upstream content repo, whole)
│   └── source/{en,ja}/chapters/…
├── apps/
│   └── site/                        # package: ef-mandate-localize-site  (Astro)
│       └── config.json              # sources -> ../../localize/source/{en,ja}/chapters
├── packages/
│   ├── core/                        # package: @anno/core
│   └── widget/                      # package: @anno/widget  (+ standalone README.md)
├── docs/                            # specs / plans / checklists (moved from commentary/docs)
├── .github/workflows/ci.yml         # pnpm install -> test / typecheck / build
├── README.md                        # monorepo README (replaces old localize README)
└── LICENSE
```

## Package naming

| Directory        | Package name              | Rationale |
|------------------|---------------------------|-----------|
| `packages/core`  | `@anno/core`              | Generic, reusable. Matches existing `core/src/anno/` module naming. |
| `packages/widget`| `@anno/widget`            | Generic on-chain annotation widget, embeddable on any site. |
| `apps/site`      | `ef-mandate-localize-site`| Application-specific (the EF Mandate reading site), not part of the reusable `@anno` product. Unscoped. |

`@anno/*` packages stay `private: true` for now; npm scope availability only
matters if/when `core`/`widget` are published standalone.

## Move map (use `git mv` to preserve history)

| Current                                   | Target                          |
|-------------------------------------------|---------------------------------|
| `commentary/site/`                        | `apps/site/`                    |
| `commentary/core/`                        | `packages/core/`                |
| `commentary/widget/`                      | `packages/widget/`              |
| `commentary/docs/`                        | `docs/`                         |
| `commentary/package.json`                 | root `package.json` (merge)     |
| `commentary/pnpm-workspace.yaml`          | root `pnpm-workspace.yaml`      |
| `commentary/pnpm-lock.yaml`               | root `pnpm-lock.yaml`           |
| `commentary/.gitignore`                   | root `.gitignore` (merge)       |

After the move, the `commentary/` directory no longer exists.

- `commentary/site/pnpm-workspace.yaml` (stray `allowBuilds` file) is **deleted**;
  its build approvals are consolidated into the root `pnpm.onlyBuiltDependencies`
  (existing `esbuild`, `sharp`, plus `keccak`, `secp256k1`).
- Root `pnpm-workspace.yaml` globs become `apps/*` and `packages/*`.

## Removed from this repo (content repo's responsibility; returns via submodule)

- `source/` → provided by `localize/source/`
- `scripts/build.py`, `Makefile`, `GLOSSARY.md` (localization PDF build toolchain)
- old root `README.md` (localization-focused) → replaced by monorepo README
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (localization-project-specific, Japanese;
  exist upstream). A site-repo CONTRIBUTING can be authored later if needed.
- `dist/` (already gitignored)

`source/` content on this branch is identical to upstream `origin/main` — no local
translation edits are lost by replacing it with the submodule.

## Submodule wiring

- `git submodule add https://github.com/ethereumjp/ef-mandate-localize-jp localize`
- `apps/site/config.json`: source paths change from `../../source/{en,ja}/chapters`
  to `../../localize/source/{en,ja}/chapters`.
  - Verified: `loadConfig`/`chaptersDir` (`apps/site/src/lib/sources.ts`) resolve
    `path` relative to `config.json`'s directory. From `apps/site/config.json`,
    `../../` reaches repo root, so `../../localize/source/...` is correct.
- Setup requires `git submodule update --init` (or `git clone --recursive`).
  Documented in root README and run in CI before install/build.

## Scope rename `@commentary/*` → `@anno/*`

- Scope: ~51 occurrences across ~20 files. Specifiers in use:
  `@commentary/core/anno/*`, `@commentary/core/lib/*`, `@commentary/core/chain`,
  `@commentary/widget`. Mechanical find/replace `@commentary/` → `@anno/`.
- Update `name` in `packages/core/package.json` (`@anno/core`) and
  `packages/widget/package.json` (`@anno/widget`); `workspace:*` dependency refs.
- `apps/site/package.json` `name` → `ef-mandate-localize-site`; its `@commentary/core`
  dependency → `@anno/core`.
- Update `apps/site/tsconfig.json` paths, `apps/site/astro.config.mjs`, and any TS
  path mappings referencing the old scope.
- Root `package.json` scripts: `--filter @commentary/site` → `--filter
  ef-mandate-localize-site`; widget/site build filters → `@anno/widget`.
- The site↔widget embed wiring (`embed:build` runs `pnpm -C ../widget run build`)
  becomes a workspace path from `apps/site` to `packages/widget`: update the
  relative `-C` path (`../widget` → `../../packages/widget`) and the `embed:copy`
  source path accordingly.

## CI replacement

`.github/workflows/build.yml` builds the localization PDF (Python + pandoc + TeX) —
that is the upstream content repo's responsibility. Replace it with a Node/pnpm CI
(`ci.yml`):

1. `actions/checkout` with `submodules: recursive`
2. setup-node + pnpm, `pnpm install`
3. `pnpm -r test`, `pnpm -r typecheck`
4. `pnpm run build:site`, `pnpm run build:widget`

## Widget standalone README (`packages/widget/README.md`, new)

Documents the widget as a standalone, embeddable annotation product:

- **What it is** — one `<script>` tag adds on-chain (EAS) commentary on selected text
  spans to any site.
- **Embed** — `<script type="module" src=".../embed.js" data-schema-uid=…></script>`,
  with the `data-*` attribute reference (from `src/config.ts`).
- **Build** — `pnpm build` (Vite → `dist/embed.js` loader + lazy-loaded app chunk).
- **Dev / Test** — `pnpm test`, `pnpm serve:test` (`test/index.html` harness).
- **Dependencies & assumptions** — React island, wagmi/viem/ethers, an EAS schema
  UID, integration with `@anno/core`.
- **Standalone note** — builds and ships independently of the site.

## Root monorepo README (new)

- This repo is the site + widget monorepo; localization comes from the upstream
  submodule.
- Setup: `git clone --recursive` (or `submodule update --init`) → `pnpm install` →
  `pnpm run dev:site:mock` / `build:site` / `build:widget`.
- Links to each workspace and to `docs/`.

## Docs & memory

- `commentary/docs/` → `docs/` (specs, plans, checklists). This spec file moves with it.
- Update the memory note "spec/plan doc location" to the new convention:
  `docs/specs/` and `docs/plans/`.

## Out of scope

- No code/logic changes to the site, core, or widget beyond import-path and config
  rewiring required by the move and rename.
- No translation content edits.
- Pushing to `ethereumjp/ef-mandate-localize-site` (separate step, pending approval).

## Verification

- `pnpm install` resolves the workspace from the new root.
- `pnpm -r test` and `pnpm -r typecheck` pass.
- `pnpm run build:site` builds with content read from `localize/source/...`.
- `pnpm run build:widget` produces `dist/embed.js`.
- Fresh `git clone --recursive` + `pnpm install` + build succeeds (submodule wiring).
