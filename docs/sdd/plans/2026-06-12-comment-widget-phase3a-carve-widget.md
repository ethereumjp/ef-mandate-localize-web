# Comment Widget — Phase 3a: Carve the `@commentary/widget` package Implementation Plan

> **For agentic workers:** Mostly mechanical (package carve + import repoints, Phase-2-style) with one small refactor (i18n decouple) and a legacy deletion. The workspace-resolution pattern is already proven (Phase 2). RECOMMENDED EXECUTION: inline/interactive, with the same gates as Phase 2 (`pnpm -r typecheck`/`test`, `pnpm --filter @commentary/site build`). Steps use checkbox (`- [ ]`).

**Goal:** Move the comment system (UI + its `web3/*` infra) into a new `@commentary/widget` package depending on `@commentary/core`, decoupled from the translation site's i18n, with the dead pre-anno EAS path deleted. The site keeps rendering its island, now importing `CommentApp` from `@commentary/widget` (one temp line, removed in Phase 3c). No behaviour change; all builds/tests stay green.

**Architecture:** Same workspace mechanics as Phase 2 (`@commentary/widget` consumed as TS source via subpath exports + Vite `ssr.noExternal` + tsconfig `paths`). The widget owns a tiny self-contained comment-UI string table and takes `lang: string` (the page language, which the URL already distinguishes: `/`=en, `/ja`=ja — `commentsForUrl` scoping is unchanged). EAS chain constants move to `core` so both the widget and the live `register-anno-schema` script share them.

**Tech Stack:** pnpm workspaces, TypeScript, Astro 6 + Vite, vitest, React 19 + wagmi + `@ethereum-attestation-service/eas-sdk`.

**Spec:** `site/docs/specs/2026-06-12-embeddable-comment-widget-design.md` (§4, §7, §10, §15 Phase 3). This plan is sub-phase **3a**; 3b (the 2-stage `embed.js` build) and 3c (site → `embed.js`) follow as their own plans.

---

## Preconditions

- Branch `feat/commentary`. Baseline: `pnpm -r test` = 113 (core 60 + site 53), `pnpm -r typecheck` clean, `pnpm --filter @commentary/site build` OK. Confirm before starting.
- `pnpm` workspace already set up (Phase 2). `node_modules/` is gitignored.

## Carve summary

**Move to `widget/src/` (→ `@commentary/widget`):** `components/comments/*` (CommentApp, CommentController is inside it, CommentCard, CommentThread, Composer, ConnectButton, SelectionPopover, AnchorStatusBadge) + `web3/{config,ethers,eas,highlight,thread}.ts`. Depends on `@commentary/core`.
**Move to `core/src/` (shared EAS infra):** the EAS chain constants `EAS_ADDRESS`, `SCHEMA_REGISTRY_ADDRESS`, `SEPOLIA_CHAIN_ID` (from `web3/constants.ts`) → `core/src/chain.ts`.
**Delete (dead pre-anno EAS path — superseded by `anno/`):** `web3/{read,schema,projectComments,constants}.ts`, `scripts/register-schema.ts`, `tests/{read,schema,projectComments}.test.ts`, the old `SCHEMA` string, and the `schema:register` npm script.
**Stays in `site/`:** content pipeline, pages, layouts, content scripts, chrome i18n.

---

## Task 1: Delete the dead pre-anno EAS path

First confirm dead, then delete. (`web3/projectComments` has no importers; `web3/read`/`schema` are imported only by `projectComments` + their own tests; the comment UI uses `anno/` via `@commentary/core`.)

- [ ] **Step 1: Re-confirm dead (no live importers).**
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/site
grep -rEn "web3/(read|schema|projectComments)\"" src scripts --include='*.ts' --include='*.tsx' --include='*.astro' | grep -vE "web3/(read|schema|projectComments)\.ts"
```
Expected: no output (only the files themselves / tests reference them). If a live `src`/`scripts` file imports them, STOP — they are not dead; report.

- [ ] **Step 2: Delete the dead modules, tests, and the legacy script.**
```bash
git rm src/web3/read.ts src/web3/schema.ts src/web3/projectComments.ts \
       tests/read.test.ts tests/schema.test.ts tests/projectComments.test.ts \
       scripts/register-schema.ts
```

- [ ] **Step 3: Remove the `schema:register` npm script** from `site/package.json` (the line `"schema:register": "tsx scripts/register-schema.ts",`). Leave `anno:schema:register`.

- [ ] **Step 4: Verify green.**
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp && pnpm -r test 2>&1 | grep -E "Tests "
pnpm --filter @commentary/site build 2>&1 | grep -iE "complete|error"
```
Expected: site tests drop by 3 files (read/schema/projectComments) → site 50, core 60 = 110 total; build OK. (`thread.test` stays — `thread` is live.)

- [ ] **Step 5: Commit.**
```bash
git add -A && git commit -m "chore(site): delete dead pre-anno EAS comment path (read/schema/projectComments/register-schema)"
```

---

## Task 2: Move EAS chain constants into `@commentary/core`

`web3/constants.ts` currently holds `EAS_ADDRESS`, `SCHEMA_REGISTRY_ADDRESS`, `SEPOLIA_CHAIN_ID` (the live anno path needs these), plus the now-deleted `SCHEMA`. Move the three addresses to core so both the widget infra and `register-anno-schema` share them.

- [ ] **Step 1: Create `core/src/chain.ts`** with the surviving constants (copy the exact values from `site/src/web3/constants.ts`):
```ts
/** EAS deployment on Sepolia (verify against https://docs.attest.org/ deployments). */
export const EAS_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
export const SCHEMA_REGISTRY_ADDRESS = "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";
export const SEPOLIA_CHAIN_ID = 11155111;
```
(Use the actual values from the current file — verify they match before writing.)

- [ ] **Step 2: Add the subpath export to `core/package.json` `exports`:** add `"./chain": "./src/chain.ts"` alongside `./lib/*` and `./anno/*`. (Keep the wildcard entries.)

- [ ] **Step 3: Delete `site/src/web3/constants.ts`** (`git rm src/web3/constants.ts`) and repoint its importers to `@commentary/core/chain`:
  - `src/web3/config.ts` (`SEPOLIA_CHAIN_ID`) → `import { SEPOLIA_CHAIN_ID } from "@commentary/core/chain";`
  - `src/web3/eas.ts` (`EAS_ADDRESS`) → `@commentary/core/chain`
  - `src/scripts/register-anno-schema.ts` (`SCHEMA_REGISTRY_ADDRESS`) → `@commentary/core/chain`
  - Run `grep -rn "web3/constants" src scripts` first to catch every importer.

- [ ] **Step 4: Verify green** (`pnpm install` if needed for the new export, then `pnpm -r typecheck && pnpm -r test && pnpm --filter @commentary/site build`). Expected: 110 tests, typecheck clean, build OK.

- [ ] **Step 5: Commit.**
```bash
git add -A && git commit -m "build(core): move EAS chain constants (EAS_ADDRESS/SCHEMA_REGISTRY_ADDRESS/SEPOLIA_CHAIN_ID) to @commentary/core/chain"
```

---

## Task 3: Decouple the comment UI from the site's i18n

The comment components import `MESSAGES` + the `Lang` union from `site/src/lib/i18n`. Give the comment UI its own string table and a generic `lang: string`. (The page's language is URL-determined and passed in; `commentsForUrl` scoping is unchanged.)

- [ ] **Step 1: Create `site/src/components/comments/i18n.ts`** (it will move to `widget/src/i18n.ts` in Task 4) with only the comment-UI keys, copied from `site/src/lib/i18n.ts` `MESSAGES`, plus a `t()` EN-fallback:
```ts
const STRINGS: Record<string, Record<string, string>> = {
  en: {
    comments: "Comments",
    reply: "Reply",
    threadTitle: "Comments",
    noComments: "No comments on this block yet.",
    pastVersion: "Comment for past version",
    statusReanchored: "Re-anchored",
    statusNeedsReview: "Needs review",
    statusOrphaned: "Block removed",
    needsReviewTitle: "Needs review (text changed)",
    pending: "This chapter isn't translated yet — showing the original (English).",
  },
  ja: {
    comments: "コメント",
    reply: "返信",
    threadTitle: "コメント",
    noComments: "このブロックにはまだコメントがありません。",
    pastVersion: "過去のバージョンに対するコメント",
    statusReanchored: "再アンカリング",
    statusNeedsReview: "要確認",
    statusOrphaned: "ブロックが削除されました",
    needsReviewTitle: "要確認（本文が変更されました）",
    pending: "この章はまだ翻訳されていません — 原文（英語）を表示しています。",
  },
};

export type CommentStringKey = keyof (typeof STRINGS)["en"];

/** Translate a comment-UI string for `lang` (any string), falling back to English. */
export function ct(lang: string, key: CommentStringKey): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key];
}
```
(Copy the exact `ja` values from `site/src/lib/i18n.ts` to avoid drift.)

- [ ] **Step 2: Update the 4 comment components** (`CommentApp`, `CommentThread`, `CommentCard`, `AnchorStatusBadge`):
  - Replace `import { MESSAGES, type Lang } from "../../lib/i18n";` (and the `type Lang`-only import in CommentApp) with `import { ct } from "./i18n";`.
  - Change every `lang: Lang` prop/type to `lang: string`.
  - Replace `MESSAGES[lang].X` / `m.X` lookups with `ct(lang, "X")` (e.g. `MESSAGES[lang].reply` → `ct(lang, "reply")`). Remove any `const m = MESSAGES[lang]`.
  - `CommentCard` date locale already uses `lang` directly (Phase 1) — keep it.

- [ ] **Step 3: `Document.astro`** passes `lang={lang}` to `<CommentApp>` — `lang` is the site `Lang`, assignable to `string`, so no change needed. Verify `check:astro` still resolves.

- [ ] **Step 4: Verify green** (`pnpm --filter @commentary/site check:astro && pnpm -r test && pnpm --filter @commentary/site build`). Expected: 110 tests, 0 errors, build OK.

- [ ] **Step 5: Commit.**
```bash
git add -A && git commit -m "refactor(site): comment UI uses a self-contained string table + lang:string (decouple from site i18n)"
```

---

## Task 4: Create `@commentary/widget` and move the comment system into it

- [ ] **Step 1: Add `widget` to the workspace** — `pnpm-workspace.yaml`:
```yaml
packages:
  - core
  - site
  - widget
```

- [ ] **Step 2: Create `widget/package.json`:**
```json
{
  "name": "@commentary/widget",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@commentary/core": "workspace:*",
    "@ethereum-attestation-service/eas-sdk": "^2.9.1",
    "@tanstack/react-query": "^5.101.0",
    "@base-ui-components/react": "1.0.0-rc.0",
    "ethers": "^6.16.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "viem": "^2.21.0",
    "wagmi": "^3.6.16"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 3: Create `widget/tsconfig.json`** (React, DOM, bundler resolution):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "strict": true,
    "verbatimModuleSyntax": false,
    "resolveJsonModule": true,
    "types": [],
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Move the files** (from repo root):
```bash
mkdir -p widget/src/comments widget/src/web3
git mv site/src/components/comments/* widget/src/comments/
git mv site/src/web3/config.ts site/src/web3/ethers.ts site/src/web3/eas.ts site/src/web3/highlight.ts site/src/web3/thread.ts widget/src/web3/
git mv site/tests/thread.test.ts widget/src/web3/thread.test.ts   # co-locate (or widget/tests)
rmdir site/src/components/comments site/src/web3 2>/dev/null || true
```
Then move the comment i18n created in Task 3: `git mv widget/src/comments/i18n.ts widget/src/i18n.ts` is NOT needed if it's already under comments/ — leave it at `widget/src/comments/i18n.ts` and keep the relative `./i18n` import. (If `site/src/web3` still has files after the move — e.g. nothing should remain — verify.)

- [ ] **Step 5: Create `widget/src/index.ts`** re-exporting the island entry:
```ts
export { default as CommentApp } from "./comments/CommentApp";
```

- [ ] **Step 6: Fix intra-widget import depths.** The comment components moved from `site/src/components/comments/` to `widget/src/comments/`, and `web3/` from `site/src/web3/` to `widget/src/web3/`. So `../../web3/config` (depth from `components/comments/`) becomes `../web3/config` (from `widget/src/comments/`). Repoint every intra-widget import:
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp/widget
grep -rEn "from \"\.\./\.\./web3/" src/comments   # these become ../web3/
```
Edit each `from "../../web3/X"` → `from "../web3/X"`. The `@commentary/core/*` imports (from Phase 2) are unchanged. The `./i18n`, `./CommentCard` etc. sibling imports are unchanged.

- [ ] **Step 7: Wire the site to import the island from the package.** In `site/src/components/Document.astro`, change `import CommentApp from "./comments/CommentApp";` → `import { CommentApp } from "@commentary/widget";`. Add `"@commentary/widget": "workspace:*"` to `site/package.json` dependencies. Add `@commentary/widget` to the Astro Vite `ssr.noExternal` array and a tsconfig `paths` entry `"@commentary/widget": ["../widget/src/index.ts"]` + `"@commentary/widget/*": ["../widget/src/*"]`.

- [ ] **Step 8: Install + verify the whole workspace.**
```bash
cd /Users/yujiym/GitHub/ef-mandate-localize-jp && pnpm install
pnpm -r typecheck
pnpm -r test
pnpm --filter @commentary/site build
grep -rn "components/comments\|web3/" site/src && echo "^ site should no longer reference moved paths"
```
Expected: typecheck clean (core/site/widget); tests 110 (thread.test now under widget if it has a test script — otherwise keep it runnable); site builds 2 pages with the island sourced from `@commentary/widget`. If Vite can't resolve `@commentary/widget` TS source, apply the same fallback as Phase 2 (Vite `resolve.alias`).

- [ ] **Step 9: Commit.**
```bash
git add -A && git commit -m "build(monorepo): carve @commentary/widget (comment UI + web3 infra); site imports the island from it"
```

---

## Self-Review

- **Spec coverage:** §4 `widget` package contents (comment UI + `web3/{config,ethers,eas,highlight}`) → Task 4; §7 authoring already done (Phase 1); §10 site-as-host begins (island now from the package; full `embed.js` switch is 3c). The EAS-constants-to-core and legacy deletion are carve prerequisites surfaced during grounding.
- **i18n:** comment UI now self-contained (`ct(lang, key)`, `lang: string`); URL-based per-language scoping (`commentsForUrl`) unchanged.
- **Behaviour preservation:** pure relocation + import repoints + a string-table swap (same strings); verified by 110 tests + build. The 3-test drop is the deleted dead legacy, not a regression.
- **Deferred:** 3b (Shadow DOM, button, display controller, 2-stage `embed.js` Vite build) and 3c (site → `embed.js`, retire island/`#wallet-slot`/`data-comments`). The temporary `@commentary/widget` island import in `Document.astro` is removed in 3c.
- **Open verification:** `widget`'s own test runner — `thread.test` is the only moved test; either give `widget` a `vitest` dev-dep + `test` script, or keep `thread.test` in `site/tests` importing `@commentary/widget/web3/thread`. Decide at execution (former is cleaner long-term).
