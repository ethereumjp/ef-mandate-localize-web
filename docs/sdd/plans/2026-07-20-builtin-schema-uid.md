# Built-in Schema UID + PUBLIC_ANNO_WIDGET_URL Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The widget carries the canonical anno schema UID as a built-in default (derived in `@anno/core` from `ANNO_SCHEMA`), `data-schema-uid` becomes an optional override, and the site drops `PUBLIC_EAS_ANNO_SCHEMA_UID` entirely; `PUBLIC_EMBED_SRC` is renamed `PUBLIC_ANNO_WIDGET_URL` and deploy-web fails loudly when it is unset.

**Architecture:** `@anno/core` gains `deriveSchemaUid()` (viem `encodePacked` + `keccak256`, the EAS SchemaRegistry UID formula) plus `ANNO_RESOLVER`/`ANNO_REVOCABLE` constants moved from the register script, and exports `ANNO_SCHEMA_UID` derived at module load. The widget's `readConfig()` falls back to that constant. The site injects the widget `<script>` unconditionally without `data-schema-uid`.

**Tech Stack:** TypeScript 7, viem, Vitest, Astro 7 (astro:env), pnpm monorepo, GitHub Actions.

**Spec:** `docs/sdd/specs/2026-07-20-builtin-schema-uid-design.md`

## Global Constraints

- The deterministic UID is `keccak256(abi.encodePacked(schema, resolver, revocable))` with resolver `0x0000000000000000000000000000000000000000`, revocable `true`. Verified value for the current `ANNO_SCHEMA` (cross-checked viem vs ethers): `0xc12b39c75a5d08a325d6b246ad3ff622c2ade9f4198b9c63ddcec472ac695a04`.
- New env var name is exactly `PUBLIC_ANNO_WIDGET_URL` (replaces `PUBLIC_EMBED_SRC`).
- `PUBLIC_EAS_ANNO_SCHEMA_UID` must not survive anywhere (code, env schema, workflows, docs).
- Loader bundle size: no new concern — the stage-1 loader already bundles viem keccak via `@anno/core` `lib/hash.ts` (block hashing for `project()`).
- Run all commands from the repo root unless stated. Tests: `pnpm --filter <pkg> exec vitest run <file>`.

---

### Task 1: `@anno/core` — `deriveSchemaUid` + `ANNO_SCHEMA_UID` (TDD)

**Files:**
- Modify: `packages/core/src/anno/constants.ts`
- Test: `packages/core/tests/anno.schema.test.ts`

**Interfaces:**
- Consumes: existing `ANNO_SCHEMA` (same file).
- Produces: `ANNO_RESOLVER: "0x0000000000000000000000000000000000000000"`, `ANNO_REVOCABLE: true` (const), `deriveSchemaUid(schema: string, resolver: \`0x${string}\`, revocable: boolean): \`0x${string}\``, `ANNO_SCHEMA_UID: \`0x${string}\`` — all exported from `@anno/core/anno/constants`.

- [ ] **Step 1: Write the failing golden test**

Append to the `describe("anno schema encode/decode")` block in `packages/core/tests/anno.schema.test.ts` (and extend the import):

```ts
import {
  ANNO_SCHEMA,
  ANNO_SCHEMA_UID,
  ANNO_RESOLVER,
  ANNO_REVOCABLE,
  deriveSchemaUid,
} from "../src/anno/constants";
```

```ts
  it("ANNO_SCHEMA_UID is the deterministic EAS UID (golden — same on every chain)", () => {
    expect(ANNO_SCHEMA_UID).toBe(
      "0xc12b39c75a5d08a325d6b246ad3ff622c2ade9f4198b9c63ddcec472ac695a04",
    );
    expect(deriveSchemaUid(ANNO_SCHEMA, ANNO_RESOLVER, ANNO_REVOCABLE)).toBe(ANNO_SCHEMA_UID);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @anno/core exec vitest run tests/anno.schema.test.ts`
Expected: FAIL — `ANNO_SCHEMA_UID` has no export.

- [ ] **Step 3: Implement in `constants.ts`**

Replace the full contents of `packages/core/src/anno/constants.ts` with:

```ts
import { encodePacked, keccak256 } from "viem";
import { ANNO_ABI } from "./encode-defs";

/**
 * The generalized any-site comment schema (spec 2026-06-11), derived from
 * `ANNO_ABI` so the ABI and the registered schema string cannot drift.
 * BYTE-STABLE: the EAS schema UID is keccak256 over this exact string —
 * see the golden test in tests/anno.schema.test.ts.
 */
export const ANNO_SCHEMA = ANNO_ABI.map((p) => `${p.type} ${p.name}`).join(",");

/** EAS empty reference UID (top-level comments; matches on-chain EMPTY_UID). */
export const EMPTY_UID = "0x" + "00".repeat(32);

/** Registration params — inputs to the UID, so they live next to the schema. */
export const ANNO_RESOLVER = "0x0000000000000000000000000000000000000000" as const;
export const ANNO_REVOCABLE = true;

/** EAS SchemaRegistry UID: keccak256(abi.encodePacked(schema, resolver, revocable)). */
export function deriveSchemaUid(
  schema: string,
  resolver: `0x${string}`,
  revocable: boolean,
): `0x${string}` {
  return keccak256(encodePacked(["string", "address", "bool"], [schema, resolver, revocable]));
}

/**
 * The canonical anno schema UID — deterministic and chain-independent, so it is
 * derived here once and shipped as the widget's default. Registration on a
 * chain (apps/web `anno:schema:register`) is still required before attesting.
 */
export const ANNO_SCHEMA_UID = deriveSchemaUid(ANNO_SCHEMA, ANNO_RESOLVER, ANNO_REVOCABLE);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @anno/core exec vitest run tests/anno.schema.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + full core suite, then commit**

Run: `pnpm --filter @anno/core typecheck && pnpm --filter @anno/core test`
Expected: clean, all tests pass.

```bash
git add packages/core/src/anno/constants.ts packages/core/tests/anno.schema.test.ts
git commit -m "feat(core): derive the canonical anno schema UID (ANNO_SCHEMA_UID)"
```

---

### Task 2: `@anno/widget` — built-in default UID, `data-schema-uid` optional (TDD)

**Files:**
- Modify: `packages/widget/src/config.ts`
- Modify: `packages/widget/README.md`
- Test: `packages/widget/test/config.test.ts`

**Interfaces:**
- Consumes: `ANNO_SCHEMA_UID` from `@anno/core/anno/constants` (Task 1).
- Produces: `readConfig().schemaUid` is always non-empty — built-in default unless `data-schema-uid` overrides.

- [ ] **Step 1: Write the failing tests**

Append to `packages/widget/test/config.test.ts` (jsdom file, imports already present; add `ANNO_SCHEMA_UID`):

```ts
import { ANNO_SCHEMA_UID } from "@anno/core/anno/constants";
```

```ts
describe("readConfig schemaUid", () => {
  it("defaults to the built-in canonical UID when data-schema-uid is absent (src fallback finds the script)", () => {
    const s = document.createElement("script");
    s.src = "https://example.ipns.dweb.link/embed.js";
    document.head.appendChild(s);
    try {
      const c = readConfig();
      expect(c.schemaUid).toBe(ANNO_SCHEMA_UID);
      // the src*="embed.js" fallback also carried the other data-* defaults
      expect(c.network).toBe("mainnet");
    } finally {
      s.remove();
    }
  });

  it("data-schema-uid overrides the built-in default", () => {
    const s = document.createElement("script");
    s.dataset.schemaUid = "0xabc";
    document.head.appendChild(s);
    try {
      expect(readConfig().schemaUid).toBe("0xabc");
    } finally {
      s.remove();
    }
  });

  it("empty data-schema-uid falls back to the built-in default", () => {
    const s = document.createElement("script");
    s.setAttribute("data-schema-uid", "");
    document.head.appendChild(s);
    try {
      expect(readConfig().schemaUid).toBe(ANNO_SCHEMA_UID);
    } finally {
      s.remove();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @anno/widget exec vitest run test/config.test.ts`
Expected: FAIL — `schemaUid` is `""`, not the built-in UID.

- [ ] **Step 3: Implement in `config.ts`**

In `packages/widget/src/config.ts`, add the import at the top:

```ts
import { ANNO_SCHEMA_UID } from "@anno/core/anno/constants";
```

and in `readConfig()` change:

```ts
    schemaUid: d.schemaUid ?? "",
```

to:

```ts
    schemaUid: d.schemaUid || ANNO_SCHEMA_UID,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @anno/widget exec vitest run test/config.test.ts`
Expected: PASS (all, including the pre-existing lang test).

- [ ] **Step 5: Update README**

In `packages/widget/README.md`:

1. In the embed example, delete the `data-schema-uid="0x…"` line (the minimal embed is now attribute-free except `src`):

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@anno/widget@0.1.0/dist/embed.js"
></script>
```

2. In the configuration table, replace the `data-schema-uid` row:

```markdown
| `data-schema-uid`  | No       | built-in canonical anno schema UID | Override to read/write a different EAS schema. |
```

- [ ] **Step 6: Typecheck + widget suite + widget build, then commit**

Run: `pnpm --filter @anno/widget typecheck && pnpm --filter @anno/widget test && pnpm run build:widget`
Expected: clean; build emits `dist/embed.js`.

```bash
git add packages/widget/src/config.ts packages/widget/test/config.test.ts packages/widget/README.md
git commit -m "feat(widget)!: built-in default schema UID; data-schema-uid now an optional override"
```

---

### Task 3: register script consumes core constants

**Files:**
- Modify: `apps/web/scripts/register-anno-schema.ts`

**Interfaces:**
- Consumes: `ANNO_SCHEMA`, `ANNO_SCHEMA_UID`, `ANNO_RESOLVER`, `ANNO_REVOCABLE` from `@anno/core/anno/constants` (Task 1).

- [ ] **Step 1: Replace local constants and duplicated UID math**

In `apps/web/scripts/register-anno-schema.ts`:

1. Change the ethers import (drop `solidityPackedKeccak256`):

```ts
import { Interface, JsonRpcProvider, Wallet } from "ethers";
```

2. Change the core import:

```ts
import {
  ANNO_SCHEMA,
  ANNO_SCHEMA_UID,
  ANNO_RESOLVER,
  ANNO_REVOCABLE,
} from "@anno/core/anno/constants";
```

3. Delete these lines:

```ts
// Registration params — identical on every chain, so the resulting UID is too.
const RESOLVER = "0x0000000000000000000000000000000000000000";
const REVOCABLE = true;
```

```ts
const uid = solidityPackedKeccak256(
  ["string", "address", "bool"],
  [ANNO_SCHEMA, RESOLVER, REVOCABLE],
);
```

4. Replace every remaining `RESOLVER` → `ANNO_RESOLVER`, `REVOCABLE` → `ANNO_REVOCABLE`, `uid` → `ANNO_SCHEMA_UID` (occurrences: the calldata `encodeFunctionData` args, the calldata console output, the EOA `registry.register` args, and the EOA mismatch check).

5. Replace both hint lines (calldata path and EOA path):

```ts
  console.log("→ set PUBLIC_EAS_ANNO_SCHEMA_UID in apps/web/.env to this value");
```

with:

```ts
  console.log("(the widget ships this UID as its built-in default — no env var needed)");
```

- [ ] **Step 2: Typecheck + smoke-run the offline calldata path**

Run: `pnpm --filter ef-mandate-localize-web typecheck`
Expected: clean.

Run: `cd apps/web && NETWORK=sepolia MODE=calldata pnpm anno:schema:calldata && cd ../..`
Expected: prints the register() calldata and `schema UID … 0xc12b39c75a5d08a325d6b246ad3ff622c2ade9f4198b9c63ddcec472ac695a04` (no key, no RPC).

- [ ] **Step 3: Commit**

```bash
git add apps/web/scripts/register-anno-schema.ts
git commit -m "refactor(web): schema registration uses core's ANNO_SCHEMA_UID/RESOLVER/REVOCABLE"
```

---

### Task 4: `apps/web` — unconditional injection, drop schema env, rename widget URL env

**Files:**
- Modify: `apps/web/src/components/Document.astro`
- Modify: `apps/web/astro.config.mjs`
- Modify: `apps/web/.env.example`

**Interfaces:**
- Consumes: widget default UID (Task 2) — the page no longer passes `data-schema-uid`.
- Produces: `PUBLIC_ANNO_WIDGET_URL` (astro:env client var) used by `Document.astro`; `PUBLIC_EAS_ANNO_SCHEMA_UID` gone.

- [ ] **Step 1: Rewrite the `Document.astro` frontmatter env block**

Replace lines 9–36 of `apps/web/src/components/Document.astro` (the `astro:env/client` import through `annotationEnabled`) with:

```astro
import {
    PUBLIC_MOCK_COMMENTS,
    PUBLIC_SEPOLIA_RPC_URL,
    PUBLIC_MAINNET_RPC_URL,
    PUBLIC_ANNO_WIDGET_URL,
} from "astro:env/client";
interface Props {
    lang: Lang;
}
const { lang } = Astro.props;
const chapters = loadChapters();

// The annotation widget is an embedded <script> (built separately as
// @anno/widget), so this site is "just another host". It ships the canonical
// schema UID as its built-in default, so no data-schema-uid is passed here.
const mock = PUBLIC_MOCK_COMMENTS ? "1" : undefined;
// Network is chosen at runtime by the widget (mainnet by default; `?mode=testnet`
// → Sepolia), so we don't pin data-network here — just pass both optional RPCs.
const rpc = PUBLIC_SEPOLIA_RPC_URL;
const mainnetRpc = PUBLIC_MAINNET_RPC_URL;
// Where to load the widget bundle from. Default: the same-origin copy produced by
// embed:build (good for local dev). Production: set PUBLIC_ANNO_WIDGET_URL to the
// widget's own gateway URL so the widget deploys/updates independently of the site.
const widgetUrl = PUBLIC_ANNO_WIDGET_URL || withBase("annotation/embed.js");
```

- [ ] **Step 2: Make the script injection unconditional**

At the bottom of `Document.astro`, replace:

```astro
{
    annotationEnabled && (
        <script
            is:inline
            type="module"
            src={embedSrc}
            data-schema-uid={schemaUid}
            data-lang={lang}
            data-mock={mock}
            data-rpc={rpc}
            data-mainnet-rpc={mainnetRpc}
        />
    )
}
```

with:

```astro
<script
    is:inline
    type="module"
    src={widgetUrl}
    data-lang={lang}
    data-mock={mock}
    data-rpc={rpc}
    data-mainnet-rpc={mainnetRpc}
/>
```

- [ ] **Step 3: Update the astro:env schema**

In `apps/web/astro.config.mjs`, delete the `PUBLIC_EAS_ANNO_SCHEMA_UID` field entirely and rename the `PUBLIC_EMBED_SRC` field key to `PUBLIC_ANNO_WIDGET_URL` (same shape):

```js
      PUBLIC_ANNO_WIDGET_URL: envField.string({
        context: "client",
        access: "public",
        optional: true,
        default: "",
      }),
```

- [ ] **Step 4: Update `.env.example`**

In `apps/web/.env.example`, delete the `PUBLIC_EAS_ANNO_SCHEMA_UID` entry and its comment block, and replace the `PUBLIC_EMBED_SRC` entry with:

```bash
# Where the page loads the widget bundle from. Empty → same-origin copy (local dev).
# Production: the widget's own gateway URL, e.g. https://<widget-ipns>.ipns.dweb.link/embed.js
PUBLIC_ANNO_WIDGET_URL=
```

Also update the registration comment's tail (the schema UID is no longer an env input — the two register commands stay, but drop any mention of setting the UID in `.env` if present).

- [ ] **Step 5: Verify — typecheck, tests, build, output HTML**

Run: `pnpm --filter ef-mandate-localize-web typecheck && pnpm --filter ef-mandate-localize-web test`
Expected: clean.

Run: `pnpm run build:web && grep -o '<script[^>]*embed.js[^>]*>' apps/web/dist/index.html`
Expected: exactly one `<script type="module" src="/annotation/embed.js" data-lang="en">` (no `data-schema-uid`, no `data-mock` — plain build), present WITHOUT any env vars set.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/Document.astro apps/web/astro.config.mjs apps/web/.env.example
git commit -m "feat(web)!: drop PUBLIC_EAS_ANNO_SCHEMA_UID; rename PUBLIC_EMBED_SRC to PUBLIC_ANNO_WIDGET_URL; always inject widget"
```

---

### Task 5: `deploy-web.yml` — rename + hard guard

**Files:**
- Modify: `.github/workflows/deploy-web.yml`

**Interfaces:**
- Consumes: repo/environment variable `PUBLIC_ANNO_WIDGET_URL` (ops swap in Task 7).

- [ ] **Step 1: Update the header comment block**

Replace lines mentioning the old vars in the top comment:

```yaml
# Builds the reading site (apps/web) in CI and deploys apps/web/dist to its OWN
# 4everland Hosting project. The widget is loaded from its own deploy via
# PUBLIC_ANNO_WIDGET_URL, so the site is managed independently (see deploy-widget.yml).
```

and in the config list, delete the `PUBLIC_EAS_ANNO_SCHEMA_UID` line and change the embed line to:

```yaml
#   variable PUBLIC_ANNO_WIDGET_URL       the widget's gateway URL (…/embed.js) — REQUIRED
#                                          (deploy fails without it; the site loads the widget from it)
```

- [ ] **Step 2: Update the build step env and add the guard**

Replace the build step:

```yaml
      - name: Build site (widget loaded externally)
        env:
          PUBLIC_ANNO_WIDGET_URL: ${{ vars.PUBLIC_ANNO_WIDGET_URL }}
        run: pnpm --filter ef-mandate-localize-web build:site

      - name: Require PUBLIC_ANNO_WIDGET_URL
        if: vars.PUBLIC_ANNO_WIDGET_URL == ''
        run: |
          echo "::error::PUBLIC_ANNO_WIDGET_URL is not set — site would ship without the widget. Deploy blocked."
          exit 1
```

(The guard sits AFTER the build on purpose: the build must be proven good even when deploy is blocked.)

- [ ] **Step 3: Validate YAML and grep for stragglers**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-web.yml'))" && grep -c 'PUBLIC_EAS_ANNO_SCHEMA_UID\|PUBLIC_EMBED_SRC' .github/workflows/deploy-web.yml || true`
Expected: no YAML error; grep count `0`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-web.yml
git commit -m "ci(deploy-web): require PUBLIC_ANNO_WIDGET_URL; drop schema UID env"
```

---

### Task 6: docs sweep

**Files:**
- Modify: `AGENTS.md:81` (gotchas), `apps/web/README.md:35`, `docs/deployment.md:28,71`

- [ ] **Step 1: Update each reference**

1. `AGENTS.md` gotcha — replace the `PUBLIC_EAS_ANNO_SCHEMA_UID` bullet with:

```markdown
- **The anno schema UID is built into the widget** (`ANNO_SCHEMA_UID` in `@anno/core/anno/constants`, derived from `ANNO_SCHEMA`; `data-schema-uid` is an optional host override). No env var — but the schema must still be **registered on-chain** once per network (`anno:schema:register`). `PUBLIC_ANNO_WIDGET_URL` (baked at build time, `apps/web/.env`) points the site at the widget bundle; empty → same-origin `annotation/embed.js`.
```

2. `apps/web/README.md` — replace the `PUBLIC_EAS_ANNO_SCHEMA_UID` bullet with:

```markdown
- `PUBLIC_ANNO_WIDGET_URL` — where the page loads the widget bundle from, **baked in at build time**;
  empty → the same-origin copy from `embed:build`. (The schema UID is built into the widget.)
```

(Adjust surrounding sentence flow to match the file's actual context when editing.)

3. `docs/deployment.md:28` — replace the "baked in at build time" sentence about the schema UID with one about `PUBLIC_ANNO_WIDGET_URL` being baked at build time; `docs/deployment.md:71` — replace "Set the resulting UID as `PUBLIC_EAS_ANNO_SCHEMA_UID` before building." with "The widget ships this UID as its built-in default — registration is the only per-chain step."

- [ ] **Step 2: Verify no references remain anywhere**

Run: `grep -rn 'PUBLIC_EAS_ANNO_SCHEMA_UID\|PUBLIC_EMBED_SRC' --include='*.md' --include='*.ts' --include='*.tsx' --include='*.astro' --include='*.mjs' --include='*.yml' --include='*.example' . | grep -v node_modules | grep -v 'docs/sdd' | grep -v dist/`
Expected: no output (the sdd spec/plan may keep historical mentions).

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md apps/web/README.md docs/deployment.md
git commit -m "docs: schema UID is built into the widget; PUBLIC_ANNO_WIDGET_URL rename"
```

---

### Task 7: ops swap + final verification

**Files:** none (GitHub environment + full-suite verification)

- [ ] **Step 1: Swap the GitHub `production` environment variables**

```bash
gh api -X POST repos/ethereumjp/ef-mandate-localize-web/environments/production/variables \
  -f name=PUBLIC_ANNO_WIDGET_URL \
  -f value="https://k51qzi5uqu5dh5zuezmrijz2dp2cwctayu2ppegxhfea4n54s48t27vna6xdx9.ipns.dweb.link/embed.js"
gh api -X DELETE repos/ethereumjp/ef-mandate-localize-web/environments/production/variables/PUBLIC_EMBED_SRC
gh api repos/ethereumjp/ef-mandate-localize-web/environments/production/variables --jq '.variables[] | .name + " = " + .value'
```

Expected final listing: `FOUR_EVERLAND_WEB_PROJECT_ID`, `FOUR_EVERLAND_WIDGET_PROJECT_ID`, `PUBLIC_ANNO_WIDGET_URL` — no `PUBLIC_EMBED_SRC`, no `PUBLIC_EAS_ANNO_SCHEMA_UID`.

- [ ] **Step 2: Full monorepo verification**

Run: `pnpm -r typecheck && pnpm -r test && pnpm run build:web`
Expected: all clean; site builds.

Run: `PUBLIC_MOCK_COMMENTS=1 pnpm --filter ef-mandate-localize-web exec astro build && grep -o '<script[^>]*embed.js[^>]*>' apps/web/dist/index.html`
Expected: script tag with `data-mock="1"` and no `data-schema-uid`.

- [ ] **Step 3: Done — hand off for review/merge**

Work is on `main`'s working branch per session flow; follow superpowers:finishing-a-development-branch (push triggers deploy-web + deploy-widget; with the swapped vars the site now ships WITH the widget and live comments — this is the intended "stage 2" release).
