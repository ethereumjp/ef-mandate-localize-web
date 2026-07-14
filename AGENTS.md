# AGENTS.md

This file provides guidance to Agent coding agents when working with code in this repository. (`CLAUDE.md` imports this file via `@AGENTS.md`.)

## What this repo is

A **pnpm monorepo for the EF Mandate localize web and a reusable, embeddable on-chain annotation widget**. Two concerns with different lifecycles:

- The **localization markdown** (the Japanese/English EF Mandate translation) is NOT in this repo — it lives upstream in `ethereumjp/ef-mandate-localize-jp` and is consumed here as the `localize/` **git submodule**.
- The **site + widget** are this repo's product. The widget (`@anno/`-scoped) is generic ("anno" = annotate any site); the site is one specific consumer.

Eventual home is `ethereumjp/ef-mandate-localize-web` (pending owner approval); the structure is named with that in mind.

## Layout

| Path | Package | Role |
|---|---|---|
| `apps/web` | `ef-mandate-localize-web` (unscoped) | Astro reading site with the annotation layer |
| `packages/core` | `@anno/core` | Anchoring engine + EAS/anno attestation layer (framework-free) |
| `packages/widget` | `@anno/widget` | Standalone embeddable widget (Vite → `embed.js`); has its own README |
| `localize/` | — | git submodule: upstream localization markdown (source of truth) |
| `docs/sdd/specs`, `docs/sdd/plans` | — | design specs and implementation plans (save new ones here, **not** `docs/superpowers/`) |

## Setup & commands

**First clone needs the submodule** or the site has no content to build:

```bash
git clone --recursive …            # or, in an existing clone:
git submodule update --init
pnpm install                       # Node 22, pnpm 11.5.3 (pinned via packageManager)
```

From the repo root:

```bash
pnpm run dev:web:mock   # Astro dev server with bundled MOCK comments (no chain/wallet)
pnpm run build:web      # static site → apps/web/dist
pnpm run build:widget    # embed bundle → packages/widget/dist/embed.js
pnpm -r test             # all packages (Vitest)
pnpm -r typecheck        # all packages (tsc --noEmit)
```

Per-package / focused:

```bash
pnpm --filter @anno/core test                       # one package's suite
pnpm --filter @anno/core exec vitest run tests/anno.schema.test.ts   # one test file
pnpm --filter @anno/core exec vitest run -t "decodes"               # by test-name pattern
pnpm --filter ef-mandate-localize-web lint         # oxlint (site only)
pnpm --filter ef-mandate-localize-web fmt          # oxfmt (site only)
pnpm --filter @anno/widget serve:test               # static server on :5180 for test/index.html (needs python3)
```

Site operational scripts (from `apps/web`): `anno:schema:register` (one-time EAS schema registration, per network), `gen:mock` (regenerate mock comments).

## Architecture (the parts that span files)

### Content flow: submodule → site, widget → site

- `apps/web/config.json` points at `../../localize/source/{en,ja}/chapters`. `src/lib/sources.ts` resolves those relative to `config.json`; `src/lib/content.ts` loads and aligns EN/JA chapters **by position** (no in-text markers — the pipeline is marker-free). Routes: `src/pages/index.astro` (English at `/`) and `[lang].astro` (translations at `/<lang>`, falling back to English).
- The site **embeds the widget as a built bundle**, not as a source import: `build`/`dev` run `embed:build`, which builds `@anno/widget` and copies its `dist/` into `apps/web/public/annotation/`. So the widget is a build-time dependency of the site, and `public/annotation/` is generated (gitignored). The host page loads it via `<script type="module" src=".../annotation/embed.js" data-schema-uid=…>`.

### `@anno/core` — anchoring engine + EAS layer

Comments are **EAS attestations anchored to an exact text span** so they survive edits to the source/translation. Two cooperating halves:

- **Re-anchoring** (`src/lib/anchoring.ts`): `makeAnchor()` records a span as `{exact quote, prefix/suffix context (CONTEXT_LEN=32), code-point offsets, blockHash}`. `project(anchor, currentBlock)` classifies it against the live text into one of `AnchorStatus = "anchored" | "re-anchored" | "needs-review" | "orphaned"` (every status except `anchored` sets `pastVersion: true` → the "Comment for past version" tag). Attestations are immutable; this is the derived current-version view. `lib/normalize.ts` (deterministic text normalization) and `lib/hash.ts` (keccak block hashing) feed it.
- **anno attestation layer** (`src/anno/*`): `schema.ts` (`AnnoFields` codec, `decodeAnno`), `read.ts` (`decodeAttestation` → `StoredAnno`), `selector.ts` (CSS selector + `nearestContainer`), `canonicalUrl.ts` + `pageKey.ts` (deterministic URL canonicalization → `pageKey()` 32-byte bucket), `locate.ts` (`locate`/`projectAnno`/`commentsForUrl`), `author.ts`. `chain.ts` holds the `NETWORKS` registry (mainnet + Sepolia EAS/SchemaRegistry addresses, chain ids, GraphQL + easscan endpoints) and `resolveNetwork(name)`.
- **Page-scoping & replies (recent design):** attestations are fetched per page via the **recipient = `pageKey(canonicalUrl)`** (not by language), and threaded replies link to their parent via the on-chain **`refUID`** (the older `parentUid` field was dropped).

### `@anno/widget` — two-stage embed

- **Stage 1 — `src/loader.ts`** (tiny, no React/wallet): reads config from the embed `<script data-*>` (`src/config.ts`), mounts a host element + **shadow root** (no style bleed), paints a floating launcher pill + a selection "Comment" popover, and runs the framework-free `display.ts` controller (read/project/paint/hit-test). It **lazy-imports `./app`** only on first open.
- **Stage 2 — `src/app.tsx`** (`mountApp(shadow, config, display, …)`): the React 19 island — wagmi/viem for wallet/chain AND for attest (a viem `writeContract` against the EAS contract in `src/web3/eas.ts`; ethers + the EAS SDK were removed from the widget in 2026-07), `src/comments/*` (Composer, CommentThread, CommentCard, ConnectButton, …), `src/web3/*` (eas, config, highlight, thread). Built by Vite (`vite.config.ts`) into a single ESM `dist/embed.js` loader + a hashed lazy `app` chunk.
- Config attributes are documented in `packages/widget/README.md`; defaults live in `src/config.ts` (`data-schema-uid` required; network is chosen at runtime — `mainnet` by default, `?mode=testnet` URL flag → Sepolia; `data-mock` for the bundled demo comments; etc.).

## Gotchas that aren't obvious from a single file

- **`localize/` submodule must be initialized** before any site build/test, or content loading fails. CI checks out with `submodules: recursive`.
- **`PUBLIC_EAS_ANNO_SCHEMA_UID` is baked at build time** (Astro static build / `apps/web/.env`). Set it before `pnpm build`; rebuild after changing `.env`. Without it the read/attest paths are inert. `.env` lives at `apps/web/.env` (gitignored; see `.env.example`).
- **Mock mode** (`PUBLIC_MOCK_COMMENTS=1`, what `dev:web:mock` sets, or widget `data-mock`) shows bundled comments with no wallet/chain — use it for UI work.
- **Network:** **mainnet by default**; append `?mode=testnet` to a page URL → Sepolia (demo / local dev). `resolveNetwork()` (`@anno/core/chain`) maps the name to EAS addresses + GraphQL endpoint. Reads go through the EAS GraphQL API; the write path needs a wallet (MetaMask/Rabby). Register the schema once per network (same string → same UID).
- **pnpm build-script approvals** live in `pnpm-workspace.yaml` under `allowBuilds:` (esbuild/keccak/secp256k1/sharp). pnpm 11 **ignores** the old `pnpm.onlyBuiltDependencies` in `package.json` and warns — keep the config in the workspace file.
- **Base path:** the site is served at root (`base: "/"`, hardcoded) — IPNS subdomain / ENS gateways. Path gateways (`…/ipns/<name>/…`) aren't supported (absolute paths). `SITE_URL` sets the canonical origin (sitemap / canonical / OG).
- The widget bundle under `apps/web/public/annotation/` is **generated** by `embed:build` — don't hand-edit it; change `packages/widget` and rebuild.
- **`check:astro` (astro check) is known-broken under TypeScript 7** — `@astrojs/language-server` can't drive tsgo yet ([withastro/astro#17268](https://github.com/withastro/astro/issues/17268), upstream). Deliberate decision (2026-07): stay on TS7 and wait; do NOT pin TS 5.x. CI doesn't run it. `tsc`/tests/build all work; `.astro` frontmatter just has no type gate until upstream fixes it.
