# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure this repo from a nested `commentary/` monorepo into a root-level pnpm monorepo (`apps/site`, `packages/core`, `packages/widget`) that consumes the localization markdown as a git submodule from upstream.

**Architecture:** Promote the existing `commentary/` workspace to the repo root, rename the npm scope `@commentary/*` → `@anno/*` (site app becomes the unscoped `ef-mandate-localize-site`), replace the in-tree `source/` localization with a `localize/` git submodule pointing at `ethereumjp/ef-mandate-localize-jp`, and swap the Python/TeX PDF CI for a pnpm CI.

**Tech Stack:** pnpm workspaces, Astro 7, Vite 7, Vitest 4, TypeScript 5.6, React 19, git submodules, GitHub Actions.

## Global Constraints

- Package names: `packages/core` = `@anno/core`; `packages/widget` = `@anno/widget`; `apps/site` = `ef-mandate-localize-site` (unscoped).
- Submodule: `localize/` → `https://github.com/ethereumjp/ef-mandate-localize-jp` (upstream/origin).
- Preserve git history for moved files: use `git mv`, never delete-and-recreate.
- `apps/site` and `packages/*` are both two levels below repo root (so `../../` from a workspace package reaches the repo root, same depth as the old `commentary/site`).
- No code/logic changes beyond import-path and config rewiring required by the move/rename/submodule. No translation content edits.
- Run commands from the repo root unless a step says otherwise: `/Users/yujiym/GitHub/ef-mandate-localize-jp`.
- Platform is macOS (BSD userland); the bulk-rename steps use `perl -pi -e` for portability.

---

### Task 1: Rename npm scope `@commentary/*` → `@anno/*` (in place, under `commentary/`)

Do this first, while the workspace still resolves from `commentary/`, so the rename is verified in the known-good layout before the disruptive move.

**Files:**
- Modify: `commentary/core/package.json` (name)
- Modify: `commentary/widget/package.json` (name + dep)
- Modify: `commentary/site/package.json` (name + dep + nothing else here)
- Modify: `commentary/package.json` (root filter scripts)
- Modify: `commentary/site/tsconfig.json` (paths key)
- Modify: `commentary/site/astro.config.mjs` (noExternal/optimizeDeps/comment)
- Modify (bulk): all `*.ts`, `*.tsx`, `*.astro`, `*.json`, `*.mjs`, `*.sh`, `*.html` under `commentary/` containing `@commentary/` (~20 files, ~51 occurrences) — see the grep list in the design spec.

**Interfaces:**
- Produces: package names `@anno/core`, `@anno/widget`, `ef-mandate-localize-site`; import specifiers `@anno/core/*`, `@anno/widget`. All later tasks use these names.

- [ ] **Step 1: Bulk-rename all `@commentary/*` references**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/commentary
grep -rl '@commentary' \
  --include='*.ts' --include='*.tsx' --include='*.astro' \
  --include='*.json' --include='*.mjs' --include='*.sh' --include='*.html' . \
  | grep -vE 'node_modules|/dist/' \
  | xargs perl -pi -e 's#\@commentary/site#ef-mandate-localize-site#g; s#\@commentary/core#\@anno/core#g; s#\@commentary/widget#\@anno/widget#g; s#\@commentary/monorepo#\@anno/monorepo#g'
```

- [ ] **Step 2: Verify no `@commentary/` references remain**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
grep -rn '@commentary' commentary \
  --include='*.ts' --include='*.tsx' --include='*.astro' \
  --include='*.json' --include='*.mjs' --include='*.sh' --include='*.html' \
  | grep -vE 'node_modules|/dist/'
```
Expected: no output (exit 1). The renamed names should appear instead — spot check:
```bash
grep -rn '@anno/\|ef-mandate-localize-site' commentary/package.json commentary/core/package.json commentary/widget/package.json commentary/site/package.json
```
Expected: core→`@anno/core`, widget→`@anno/widget` (+ dep `@anno/core`), site→`ef-mandate-localize-site` (+ dep `@anno/core`), root scripts filter `ef-mandate-localize-site` / `@anno/widget`.

- [ ] **Step 3: Reinstall to relink renamed workspace packages**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/commentary
pnpm install
```
Expected: install completes; `node_modules/@anno/{core,widget}` symlinks now exist.

- [ ] **Step 4: Verify typecheck and tests pass**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/commentary
pnpm -r typecheck
pnpm -r test
```
Expected: all packages typecheck clean; all Vitest suites pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git add -A commentary
git commit -m "refactor(monorepo): rename scope @commentary/* -> @anno/*, site -> ef-mandate-localize-site"
```

---

### Task 2: Promote the monorepo to the repo root

`git mv` the workspace from `commentary/` to root (`apps/`, `packages/`, `docs/`), fix the relative paths that change because cross-package depth changed (`../core` → `../../packages/core`, `../widget` → `../../packages/widget`), and consolidate workspace config. The localization `source/` stays at the repo root for now, so the site still builds (config still points at `../../source` which resolves to repo root from `apps/site` — same depth as before).

**Files:**
- Move: `commentary/site` → `apps/site`; `commentary/core` → `packages/core`; `commentary/widget` → `packages/widget`; `commentary/docs` → `docs`
- Move: `commentary/package.json` → `package.json`; `commentary/pnpm-workspace.yaml` → `pnpm-workspace.yaml`; `commentary/pnpm-lock.yaml` → `pnpm-lock.yaml`
- Delete: `commentary/site/pnpm-workspace.yaml` (stray `allowBuilds` file); `commentary/.gitignore` (merged into root)
- Modify: root `pnpm-workspace.yaml` (globs); root `package.json` (onlyBuiltDependencies + packageManager); root `.gitignore` (merge)
- Modify: `apps/site/tsconfig.json` (path value); `apps/site/package.json` (embed scripts); `apps/site/scripts/gen-mock-comments.ts` (relative URL)

**Interfaces:**
- Consumes: package names from Task 1.
- Produces: root workspace at repo root; `apps/site`, `packages/core`, `packages/widget`, `docs/`. The `localize/` submodule does NOT exist yet — Task 3 adds it; `source/` is still at root.

- [ ] **Step 1: Move directories and root config files with `git mv`**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
mkdir -p apps packages
git mv commentary/site apps/site
git mv commentary/core packages/core
git mv commentary/widget packages/widget
git mv commentary/docs docs
git mv commentary/package.json package.json
git mv commentary/pnpm-workspace.yaml pnpm-workspace.yaml
git mv commentary/pnpm-lock.yaml pnpm-lock.yaml
git rm commentary/.gitignore
git rm apps/site/pnpm-workspace.yaml
rm -rf commentary   # remove now-empty dir (untracked node_modules/.gstack/.superpowers leftovers)
```

- [ ] **Step 2: Rewrite root `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Edit root `package.json` — build approvals + packageManager**

Set `pnpm.onlyBuiltDependencies` to include the keccak/secp256k1 approvals from the deleted stray file, and add a root `packageManager` so CI/local pin the same pnpm:

```json
{
  "name": "@anno/monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.5.3+sha512.7ac1c919341c213a34dc0d02afb7143c5c26ac26ee8c4782deea821b8ac64d2134a081fd8941dae6e29bbb48f58dfc2b7fbceeccc07cb2f09d219d342a4969ed",
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "dev:site:mock": "pnpm --filter ef-mandate-localize-site run dev:mock",
    "build:site": "pnpm --filter ef-mandate-localize-site build",
    "build:widget": "pnpm --filter @anno/widget build"
  },
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild",
      "keccak",
      "secp256k1",
      "sharp"
    ]
  }
}
```
(The scripts already carry the Task 1 renames; only `packageManager` and the two extra `onlyBuiltDependencies` entries are new.)

- [ ] **Step 4: Rewrite root `.gitignore` (merge localize + node ignores)**

```gitignore
node_modules/
dist/
.astro/
*.tsbuildinfo
.env
.DS_Store
.gstack/
.superpowers/
# Embed bundle copied from @anno/widget into the site's served public dir
apps/site/public/commentary/
```

- [ ] **Step 5: Fix `apps/site/tsconfig.json` path (depth changed)**

Change the `paths` value (key already `@anno/core/*` from Task 1):
```json
"paths": {
  "@anno/core/*": ["../../packages/core/src/*"]
}
```

- [ ] **Step 6: Fix `apps/site/package.json` embed scripts (depth changed)**

```json
"embed:build": "pnpm --filter @anno/widget run build && pnpm run embed:copy",
"embed:copy": "rm -rf public/commentary && mkdir -p public/commentary && cp -R ../../packages/widget/dist/. public/commentary/",
```

- [ ] **Step 7: Fix `apps/site/scripts/gen-mock-comments.ts` relative URL (depth changed)**

Line ~136 — update the path from the script's new location (`apps/site/scripts/` → repo root → `packages/core`):
```ts
const outPath = fileURLToPath(new URL("../../../packages/core/src/anno/mock-comments.json", import.meta.url));
```

- [ ] **Step 8: Reinstall from the new root (regenerates lockfile importers)**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
pnpm install
```
Expected: install succeeds; lockfile importer keys become `apps/site`, `packages/core`, `packages/widget`.

- [ ] **Step 9: Verify typecheck, tests, and both builds from root**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
pnpm -r typecheck
pnpm -r test
pnpm run build:widget
pnpm run build:site
```
Expected: typecheck/tests pass; `packages/widget/dist/embed.js` produced; `apps/site/dist/` built (site still reads `source/` at repo root via the unchanged `config.json`).

- [ ] **Step 10: Commit**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git add -A
git commit -m "refactor(monorepo): promote workspace to root (apps/site, packages/*, docs/)"
```

---

### Task 3: Replace in-tree `source/` with the `localize/` git submodule

Add the upstream localization repo as the `localize/` submodule, repoint the site config at it, and remove the localization-build files that now belong solely to the upstream content repo.

**Files:**
- Create: `.gitmodules` (via `git submodule add`); `localize/` (submodule gitlink)
- Modify: `apps/site/config.json` (source paths)
- Delete: `source/`, `scripts/build.py` (and the now-empty `scripts/`), `Makefile`, `GLOSSARY.md`

**Interfaces:**
- Consumes: root layout from Task 2.
- Produces: `localize/source/{en,ja}/chapters/…`; `apps/site/config.json` pointing at `../../localize/source/...`.

- [ ] **Step 1: Add the submodule**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git submodule add https://github.com/ethereumjp/ef-mandate-localize-jp localize
```
Expected: `localize/` populated; `.gitmodules` created.

- [ ] **Step 2: Verify the submodule carries the expected chapters**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git submodule status
ls localize/source/en/chapters localize/source/ja/chapters
```
Expected: a pinned commit for `localize`; chapter `.md` files present under both languages.

- [ ] **Step 3: Repoint `apps/site/config.json` at the submodule**

```json
{
  "sources": [
    {
      "lang": "en",
      "path": "../../localize/source/en/chapters"
    },
    {
      "lang": "ja",
      "path": "../../localize/source/ja/chapters"
    }
  ]
}
```

- [ ] **Step 4: Remove the localization-build files (now upstream's responsibility)**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git rm -r source
git rm scripts/build.py
git rm Makefile GLOSSARY.md
```
Expected: `scripts/` disappears (it held only `build.py`).

- [ ] **Step 5: Verify the site builds and tests pass against the submodule**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
pnpm --filter ef-mandate-localize-site test
pnpm run build:site
```
Expected: site tests (content/sources/i18n/render) pass reading from `localize/source`; `apps/site/dist/` built.

- [ ] **Step 6: Commit**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git add -A
git commit -m "feat(monorepo): consume localization via localize/ git submodule (upstream ethereumjp)"
```

---

### Task 4: Replace the PDF-build CI with a pnpm CI

The existing `build.yml` runs the Python/pandoc/TeX localization build — that belongs to the upstream content repo. Replace it with a Node/pnpm workflow that checks out the submodule and runs install/typecheck/test/build.

**Files:**
- Delete: `.github/workflows/build.yml`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Remove the old workflow**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git rm .github/workflows/build.yml
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository (with submodules)
        uses: actions/checkout@v6
        with:
          submodules: recursive

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11

      - name: Set up Node
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm -r typecheck

      - name: Test
        run: pnpm -r test

      - name: Build widget
        run: pnpm run build:widget

      - name: Build site
        run: pnpm run build:site
```

- [ ] **Step 3: Verify the workflow is valid YAML and self-consistent**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
node -e "const y=require('node:fs').readFileSync('.github/workflows/ci.yml','utf8'); if(!/submodules:\s*recursive/.test(y)||!/pnpm install/.test(y)) throw new Error('ci.yml missing required steps'); console.log('ci.yml OK')"
```
Expected: `ci.yml OK`. (GitHub Actions can only fully run on push; this checks the required wiring locally.)

- [ ] **Step 4: Commit**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git add -A
git commit -m "ci(monorepo): replace PDF build with pnpm typecheck/test/build (+submodule checkout)"
```

---

### Task 5: Add the standalone widget README

The widget can be built and embedded independently of the site; give it its own README documenting embedding on any host page.

**Files:**
- Create: `packages/widget/README.md`

- [ ] **Step 1: Create `packages/widget/README.md`**

````markdown
# @anno/widget

A standalone, embeddable **on-chain annotation widget**. Add one `<script>` tag to any
site and readers can attach comments to the exact text span they select — each comment is
an [EAS](https://attest.org) attestation, anchored so it survives edits to the page. No
backend, no build step on the host site.

## Embed

Build produces a single ESM loader (`dist/embed.js`) that lazy-loads the React app on
first use. Drop it on any page:

```html
<script
  type="module"
  src="https://your.cdn/commentary/embed.js"
  data-schema-uid="0x…"
></script>
```

The loader injects a floating launcher pill plus a selection "Comment" popover, both inside
a shadow root (no style bleed into the host page).

### Configuration (`data-*` attributes)

| Attribute          | Required | Default                          | Notes |
|--------------------|----------|----------------------------------|-------|
| `data-schema-uid`  | Yes      | —                                | EAS schema UID the widget reads/writes. |
| `data-network`     | No       | `sepolia`                        | Target network. |
| `data-rpc`         | No       | public node                      | JSON-RPC endpoint for the write path. |
| `data-eas-graphql` | No       | network default                  | EAS GraphQL endpoint for the read path. |
| `data-position`    | No       | `bottom-right`                   | Launcher corner: `bottom-right` or `bottom-left`. |
| `data-lang`        | No       | `<html lang>` then `en`          | UI language. |
| `data-theme`       | No       | `auto`                           | Color theme. |
| `data-mock`        | No       | off                              | `1`/`true` uses bundled mock comments (demo, no chain calls). |

## Develop

```bash
pnpm --filter @anno/widget build       # Vite → dist/embed.js + lazy app chunk
pnpm --filter @anno/widget test        # Vitest unit tests
pnpm --filter @anno/widget serve:test  # static server on :5180
# then open http://localhost:5180/test/  (dogfoods the built embed.js on a plain page)
```

## Dependencies & assumptions

- The mounted app is a React 19 island using wagmi/viem and ethers v6 for wallet + chain
  access, and the EAS SDK for attestations.
- Anchoring, selectors, schema encode/decode, and EAS read helpers come from
  [`@anno/core`](../core).
- The host page needs readable text containers; the widget anchors selections to the
  nearest stable container (see `@anno/core/anno/selector`).

## Standalone build

`@anno/widget` builds and ships independently of `apps/site`. The site simply copies the
built `dist/` into its served `public/commentary/` (see the site's `embed:build` script),
but any static host can serve `embed.js` the same way.
````

- [ ] **Step 2: Verify the README exists and references the right names**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
grep -q '@anno/widget' packages/widget/README.md && grep -q 'data-schema-uid' packages/widget/README.md && echo "widget README OK"
```
Expected: `widget README OK`.

- [ ] **Step 3: Commit**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git add packages/widget/README.md
git commit -m "docs(widget): standalone embeddable widget README"
```

---

### Task 6: Replace the root README + remove localization-project meta docs + update memory

Turn the root README from a localization-project doc into a monorepo doc, drop the
localization-specific contributor docs (they live upstream), and update the doc-location
memory to the new `docs/` convention.

**Files:**
- Modify (overwrite): `README.md`
- Delete: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- Modify: `/Users/yujiym/.claude/projects/-Users-yujiym-GitHub-ef-mandate-localize-jp/memory/spec-plan-doc-location.md`

- [ ] **Step 1: Overwrite `README.md`**

```markdown
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
```

- [ ] **Step 2: Remove localization-project contributor docs**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git rm CONTRIBUTING.md CODE_OF_CONDUCT.md
```

- [ ] **Step 3: Update the doc-location memory to the new convention**

Edit `spec-plan-doc-location.md` so its body points specs to `docs/specs/` and plans to
`docs/plans/` (repo root), replacing the old `site/docs/...` paths. Keep the frontmatter.

- [ ] **Step 4: Verify**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
grep -q 'ef-mandate-localize-site' README.md && grep -q 'localize/ git submodule\|localize/` git submodule' README.md && echo "root README OK"
test ! -e CONTRIBUTING.md && test ! -e CODE_OF_CONDUCT.md && echo "meta docs removed"
```
Expected: `root README OK` and `meta docs removed`.

- [ ] **Step 5: Commit**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git add -A README.md
git commit -m "docs(monorepo): root README for site+widget monorepo; drop localize-only meta docs"
```

---

### Task 7: Final verification gate

Confirm the whole monorepo builds clean from the new structure, mirroring a fresh checkout.

- [ ] **Step 1: Clean reinstall and full verification**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git submodule update --init --recursive
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm run build:widget
pnpm run build:site
```
Expected: install, typecheck, all tests, and both builds succeed.

- [ ] **Step 2: Confirm structure and submodule are wired**

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
test -d apps/site && test -d packages/core && test -d packages/widget && test -d docs && test ! -d commentary && echo "layout OK"
git submodule status | grep localize
grep -rn '@commentary' apps packages --include='*.ts' --include='*.tsx' --include='*.astro' --include='*.json' --include='*.mjs' | grep -vE 'node_modules|/dist/' || echo "no @commentary refs"
test -f localize/source/ja/chapters/01* 2>/dev/null || ls localize/source/ja/chapters | head -1
```
Expected: `layout OK`; a `localize` submodule line; `no @commentary refs`; chapter files present.

- [ ] **Step 3: (No commit — verification only.)** If any drift surfaced (e.g. lockfile), stage and commit it:

```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
git status --short
# if pnpm-lock.yaml changed:
git add pnpm-lock.yaml && git commit -m "chore: refresh lockfile after restructure"
```

---

## Notes (non-blocking, out of scope for this plan)

- `apps/site/astro.config.mjs` keeps `base: "/ef-mandate-localize-jp"` (env-overridable via
  `BASE_PATH`). Update it when the repo is renamed/pushed to `ethereumjp/ef-mandate-localize-site`.
- `apps/site/scripts/deploy-pages.sh` derives its dir from `$BASH_SOURCE` and still works
  after the move; its `fork` remote default may need revisiting at deploy time.
- Pushing to `ethereumjp/ef-mandate-localize-site` is a separate step pending owner approval.

## Self-Review

- **Spec coverage:** target layout (T2), package naming (T1), move map (T2), localize-file
  removal (T3), submodule wiring (T3), scope rename (T1), CI replacement (T4), widget README
  (T5), root README + docs/memory (T6), verification (T7) — all spec sections mapped.
- **Placeholders:** none — every edit shows exact content/commands.
- **Type/name consistency:** `@anno/core`, `@anno/widget`, `ef-mandate-localize-site`, and
  `localize/` used identically across all tasks.
