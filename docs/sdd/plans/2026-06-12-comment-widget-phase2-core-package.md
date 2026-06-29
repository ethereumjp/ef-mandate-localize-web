# Comment Widget — Phase 2: Extract `@commentary/core` (pnpm workspace) Implementation Plan

> **For agentic workers:** This is a build-tooling restructure. The file carve and import repoints are mechanical and fully specified; the **workspace resolution steps need iteration** (Astro/Vite/tsc resolving a workspace TS package). RECOMMENDED EXECUTION: **inline/interactive** (drive the tooling hands-on, verify at each gate) rather than blind subagents. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the single `site/` package into a 2-package pnpm workspace by extracting a framework-free `@commentary/core` (the anchoring primitives + `anno/*`), with `site` depending on it. No behavior change; every existing build/test stays green. (Scope: `core`-only — the `widget` package is deferred to Phase 3 when it has the `embed.js` build to justify the boundary.)

**Architecture:** `core/` is consumed as TypeScript source via wildcard subpath exports (`@commentary/core/lib/*`, `@commentary/core/anno/*`); pnpm symlinks it into `site/node_modules`. `core`'s internal `anno/ → lib/` imports are unchanged (the `lib/`+`anno/` subdir structure is preserved inside `core/src`). Only *cross-package* imports in `site` change (prefix `../lib/` / `../anno/` → `@commentary/core/lib/` / `@commentary/core/anno/`).

**Tech Stack:** pnpm workspaces, TypeScript (strict), Astro 6 + Vite, vitest 2 + jsdom, `@ethereum-attestation-service/eas-sdk` + `viem` (core's only runtime deps).

**Spec:** `site/docs/specs/2026-06-12-embeddable-comment-widget-design.md` (§4, §15 Phase 2).

---

## Preconditions

- Branch `feat/commentary`. Baseline: from `site/`, `npm test` = 113 passing, `npm run check:astro` = 0 errors. Confirm before starting.
- Package manager: **pnpm**. If `pnpm` is not installed, stop and report (do not silently use npm — workspace linking needs pnpm).
- **Minimal-churn deviations from spec §15** (deliberate, to keep this phase small): `source/` stays at the repo root (site's `config.json` already references `../source`, which still resolves), and docs stay at `site/docs/` (just consolidated there). Moving them is not needed for a `core` extraction.
- Out of scope: the `widget` package, Shadow DOM, the embed build, any `web3/*` move.

## The carve (what moves to `core/`)

**`core/src/lib/`** (moved from `site/src/lib/`): `anchoring.ts`, `hash.ts`, `normalize.ts`, `anchor-dom.ts`.
**`core/src/anno/`** (moved from `site/src/anno/`): the entire directory — `canonicalUrl.ts`, `read.ts`, `locate.ts`, `selector.ts`, `schema.ts`, `author.ts`, `encode-defs.ts`, `constants.ts`, `mock.ts`, `mock-comments.json`.
**`core/tests/`** (moved from `site/tests/`): `anchoring.test.ts`, `anchoring-integration.test.ts`, `hash.test.ts`, `normalize.test.ts`, `anchor-dom.test.ts`, `selector.test.ts`, `anno.canonicalUrl.test.ts`, `anno.selector.test.ts`, `anno.locate.test.ts`, `anno.scope.test.ts`, `anno.schema.test.ts`, `anno.author.test.ts`.

**Stays in `site/`:** all of `web3/*`, `components/*`, `lib/{blocks,sources,content,i18n,render,anchors,ids,inject,check}.ts`, `pages/`, `layouts/`, `scripts/`, `config.json`, and the remaining tests (`blocks`, `check`, `content`, `i18n`, `ids`, `inject`, `render`, `sources`, `anchors`, `read`, `schema`, `thread`, `highlight`, `projectComments`, `smoke`). The `web3/`-and-site tests that import core modules get their imports repointed but the files stay in `site/tests`.

> Before moving a test, the executor MUST confirm it imports only `core` modules (run `grep -E "^import" tests/<f>.test.ts`); if it imports any `web3/*` or site `lib/*`, it stays in `site/tests` with its core imports repointed instead.

---

## Task 1: Workspace skeleton + `@commentary/core` package

**Files:** Create `pnpm-workspace.yaml`, root `package.json`, `core/package.json`, `core/tsconfig.json`; move the core `src`/`tests` files (above) into `core/`.

- [ ] **Step 1: Create the workspace root files.**

`pnpm-workspace.yaml` (repo root):
```yaml
packages:
  - core
  - site
```

Root `package.json` (repo root) — private workspace root that delegates:
```json
{
  "name": "@commentary/monorepo",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "build": "pnpm --filter @commentary/site build"
  }
}
```

- [ ] **Step 2: Move the core files** (preserving the `lib/`+`anno/` subdir structure so intra-core imports stay valid). From the repo root:
```bash
mkdir -p core/src/lib core/src/anno core/tests
git mv site/src/lib/anchoring.ts site/src/lib/hash.ts site/src/lib/normalize.ts site/src/lib/anchor-dom.ts core/src/lib/
git mv site/src/anno/* core/src/anno/
git mv site/tests/anchoring.test.ts site/tests/anchoring-integration.test.ts site/tests/hash.test.ts site/tests/normalize.test.ts site/tests/anchor-dom.test.ts site/tests/selector.test.ts core/tests/
git mv site/tests/anno.canonicalUrl.test.ts site/tests/anno.selector.test.ts site/tests/anno.locate.test.ts site/tests/anno.scope.test.ts site/tests/anno.schema.test.ts site/tests/anno.author.test.ts core/tests/
rmdir site/src/anno 2>/dev/null || true
```
(If any `git mv` fails because a file does not exist or has a different name, STOP and report — do not guess.)

- [ ] **Step 3: Fix the moved tests' import depth.** The moved tests previously imported via `../src/...`; in `core/tests/` they now sit one level under `core/`, so `../src/...` still resolves to `core/src/...` — **no change needed for `../src/lib/*` and `../src/anno/*` imports** (they now point into `core/src`). Verify:
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/core
grep -rEn "from \"\.\./src/(web3|components|lib/(blocks|sources|content|i18n|render|anchors|ids|inject|check))" tests || echo "OK: no core test imports a site-only module"
```
Expected: `OK …`. If a moved test imports a site-only module, it was mis-carved — move it back to `site/tests` and repoint instead.

- [ ] **Step 4: Create `core/package.json`:**
```json
{
  "name": "@commentary/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./lib/*": "./src/lib/*.ts",
    "./anno/*": "./src/anno/*.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ethereum-attestation-service/eas-sdk": "^2.9.1",
    "viem": "^2.21.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "jsdom": "^29.1.1"
  }
}
```

- [ ] **Step 5: Create `core/tsconfig.json`** (strict, standalone — Astro's base isn't appropriate for a framework-free lib):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": false,
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 6: Install + verify `core` in isolation.**
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
pnpm install
pnpm --filter @commentary/core test
pnpm --filter @commentary/core typecheck
```
Expected: pnpm links the workspace; `core` tests pass (the 12 moved files); `core` typecheck = 0 errors. If `tsc` complains about importing `.ts` paths or JSON, add `"allowImportingTsExtensions": false` is NOT wanted — instead confirm `moduleResolution: bundler` (which allows extensionless TS imports). Iterate here until green.

- [ ] **Step 7: Commit.**
```bash
git add -A
git commit -m "build(monorepo): extract @commentary/core (anchoring + anno) as a pnpm workspace package"
```

---

## Task 2: Wire `site` → `@commentary/core` and repoint imports

**Files:** Modify `site/package.json`, `site/astro.config.mjs`, `site/tsconfig.json`, and every `site` file importing a core module.

- [ ] **Step 1: Add the workspace dependency** to `site/package.json` `dependencies`:
```json
"@commentary/core": "workspace:*"
```
and remove `@ethereum-attestation-service/eas-sdk` from `site`'s deps ONLY IF nothing in `site/` still imports it directly (check: `grep -rn "eas-sdk" site/src site/scripts` — `web3/eas.ts`/`web3/schema.ts` likely still use it, so KEEP it in `site` deps if so). Then `pnpm install` from the repo root.

- [ ] **Step 2: Repoint all `site` cross-package imports** to `@commentary/core`. The rule is a pure prefix rewrite:
  - `"../lib/anchoring"` / `"../../lib/anchoring"` / `"../src/lib/anchoring"` → `"@commentary/core/lib/anchoring"` (same for `hash`, `normalize`, `anchor-dom`)
  - `"../anno/<x>"` / `"../../anno/<x>"` / `"../src/anno/<x>"` → `"@commentary/core/anno/<x>"`

  Apply to every match. Find them all first:
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/site
grep -rEn "from \"(\.\.?/)+(src/)?(lib/(anchoring|hash|normalize|anchor-dom)|anno/)" src scripts tests
```
  Known sites (verify against the grep): `src/components/comments/*` (CommentApp, etc.), `src/web3/{projectComments,highlight,…}.ts`, `src/lib/anchors.ts` (imports `lib/anchoring`/`hash`), `scripts/{gen-mock-comments,reanchor-demo,register-anno-schema}.ts`, and the site tests that test `web3/*` but import core (`tests/projectComments.test.ts`, `tests/anchors.test.ts`, etc.). Edit each import line per the rule above.

- [ ] **Step 3: Make Astro/Vite + tsc resolve the workspace TS package.** Because `core` ships `.ts` source (no build), the site bundler/compiler must transpile it.

  `site/astro.config.mjs` — add `@commentary/core` to Vite's `ssr.noExternal` and ensure it's not pre-bundled as an opaque dep:
```js
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    ssr: { noExternal: ["@commentary/core"] },
    optimizeDeps: { exclude: ["@commentary/core"] },
  },
});
```

  `site/tsconfig.json` — add a `paths` mapping so `tsc`/`astro check` resolve core types from source (belt-and-suspenders alongside the package `exports`):
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true,
    "verbatimModuleSyntax": false,
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": {
      "@commentary/core/*": ["../core/src/*"]
    }
  },
  "include": ["src", "scripts", "tests"],
  "exclude": ["dist", ".astro"]
}
```
  Note the `paths` value maps `@commentary/core/lib/anchoring` → `../core/src/lib/anchoring` (the `exports` map's `./lib/*` already does this at runtime; `paths` covers the type-checker).

- [ ] **Step 4: Verify the whole workspace is green.**
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/site
grep -rEn "from \"(\.\.?/)+(src/)?(lib/(anchoring|hash|normalize|anchor-dom)|anno/)" src scripts tests   # expect: nothing (all repointed)
npm run check:astro
npm test
npm run build
```
Expected: no stale relative core imports; `check:astro` 0 errors; `site` tests pass (113 minus the 12 moved to core = the remainder); `build` succeeds (2 pages). Also run the full workspace suite from the root: `pnpm -r test` → core (12) + site (remainder) = 113 total, all green.

  **If Vite fails to resolve/transpile `@commentary/core`** (e.g. "failed to resolve import" or a syntax error from un-transpiled TS): the fallback is a Vite `resolve.alias` mapping `@commentary/core` → `../core/src` (mirroring the tsconfig `paths`). Add under `vite:` — `resolve: { alias: { "@commentary/core": new URL("../core/src", import.meta.url).pathname } }` and drop the `exports`-based resolution. Iterate until `build` + `check:astro` are green.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "build(monorepo): site depends on @commentary/core; repoint imports + Vite/tsc resolution"
```

---

## Task 3: Final verification (whole workspace, behavior unchanged)

- [ ] **Step 1: Full green from the root.**
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp
pnpm -r typecheck
pnpm -r test
pnpm --filter @commentary/site build
```
Expected: every package typechecks; total tests = 113 (core + site); site builds 2 pages.

- [ ] **Step 2: Behavior spot-check.** `pnpm --filter @commentary/site dev:mock`, open `/`, confirm the reading site + comment island still render and the mock comments highlight (no runtime regression from the package split).

- [ ] **Step 3: Confirm the seam.**
```bash
grep -rn "@commentary/core" site/src/components site/src/web3 | head   # site consumes core via the package name
grep -rEn "from \"(\.\.?/)+(lib/(anchoring|hash|normalize|anchor-dom)|anno/)" site/src   # expect: nothing
```

---

## Self-Review

- **Spec coverage:** §4 `core` package (`lib` primitives + `anno`) → Task 1; `site` depends on `core` → Task 2. The `widget` package + `docs`-to-root + `source`-under-site from §15 are deliberately deferred/skipped (documented in Preconditions) — `widget` lands in Phase 3.
- **Behavior preservation:** pure file relocation + import repointing + bundler/compiler config; no logic changes. Verified by the full 113-test suite staying green and the site build succeeding.
- **Type/name consistency:** package name `@commentary/core`; subpath exports `./lib/*` + `./anno/*`; the prefix-rewrite rule is uniform across src/scripts/tests. `core` internal `anno → lib` imports unchanged (subdir structure preserved).
- **Risk / placeholder note:** the workspace-resolution steps (Task 1 Step 6, Task 2 Steps 3–4) are the genuinely uncertain part and carry explicit verification gates + a documented Vite-alias fallback — hence the inline-execution recommendation. Everything else is mechanical and exact.
