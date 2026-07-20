# Built-in schema UID + widget URL rename — design

Date: 2026-07-20
Status: approved

## Problem

The widget is meant to be a drop-in embed ("annotate any site"), yet it only
works if the host page passes `data-schema-uid`. The site in turn needs
`PUBLIC_EAS_ANNO_SCHEMA_UID` baked at build time. But the anno schema UID is
deterministic — `keccak256(abi.encodePacked(schema, resolver, revocable))`,
identical on every chain — and the schema string (`ANNO_SCHEMA`) already lives
in `@anno/core`, which the widget bundles. The UID is therefore fully
computable inside the widget; requiring hosts to supply it leaks an EAS
concern into every host for no benefit.

Separately, `PUBLIC_EMBED_SRC` does not say *what* embed it points at, and a
web deploy without it silently ships a site whose comments 404 (the
production `build:site` does not bundle the widget).

## Design

### 1. `@anno/core` — single source of truth for the UID

In `src/anno/constants.ts`:

- `ANNO_RESOLVER = "0x0000000000000000000000000000000000000000"` and
  `ANNO_REVOCABLE = true` — moved here from
  `apps/web/scripts/register-anno-schema.ts` because they are inputs to the
  UID and must live next to the schema definition.
- `deriveSchemaUid(schema, resolver, revocable)` — viem `encodePacked` +
  `keccak256` (matches EAS SchemaRegistry's UID computation).
- `ANNO_SCHEMA_UID = deriveSchemaUid(ANNO_SCHEMA, ANNO_RESOLVER, ANNO_REVOCABLE)`
  — derived at module load from `ANNO_SCHEMA`, so it cannot drift.

Testing: golden test pinning the exact UID hex (same style as the existing
BYTE-STABLE schema-string golden test).

### 2. `@anno/widget` — default UID, optional override

- `config.ts`: `schemaUid: d.schemaUid || ANNO_SCHEMA_UID` — empty/absent
  `data-schema-uid` falls back to the built-in canonical UID; an explicit
  value still overrides (escape hatch for third-party hosts running their own
  schema).
- `findScript()` currently prefers `script[data-schema-uid]`. Since the site
  will stop passing that attribute, the `script[src*="embed.js"]` fallback
  becomes the primary path — pin it with a test.
- `README.md`: `data-schema-uid` documented as optional override (default:
  built-in canonical anno schema UID).

### 3. `apps/web` — drop the schema env, rename the embed env

- `Document.astro`: remove the `PUBLIC_EAS_ANNO_SCHEMA_UID` import,
  `schemaUid`, and `annotationEnabled`; inject the widget `<script>`
  unconditionally, without `data-schema-uid` (`data-mock` unchanged).
- Rename `PUBLIC_EMBED_SRC` → `PUBLIC_ANNO_WIDGET_URL` everywhere
  (`Document.astro`, `astro.config.mjs` env schema, `.env.example`,
  `deploy-web.yml`).
- Remove `PUBLIC_EAS_ANNO_SCHEMA_UID` from `astro.config.mjs`,
  `.env.example`, and `deploy-web.yml`.
- `scripts/register-anno-schema.ts`: use `ANNO_RESOLVER` / `ANNO_REVOCABLE`
  from core so registration and derivation share inputs structurally.

### 4. `deploy-web.yml` — block deploy when the widget URL is missing

Build always runs; deploying without `PUBLIC_ANNO_WIDGET_URL` would publish a
site with broken comments, so fail loudly (unlike the soft-skip for missing
token/project id, which exists so forks stay green):

```yaml
- name: Require PUBLIC_ANNO_WIDGET_URL
  if: vars.PUBLIC_ANNO_WIDGET_URL == ''
  run: |
    echo "::error::PUBLIC_ANNO_WIDGET_URL is not set — site would ship without the widget. Deploy blocked."
    exit 1
```

### 5. Operations (not code)

- GitHub `production` environment: create `PUBLIC_ANNO_WIDGET_URL` with the
  current widget IPNS gateway URL, delete `PUBLIC_EMBED_SRC` and any
  `PUBLIC_EAS_ANNO_SCHEMA_UID`.
- On-chain schema **registration** (`anno:schema:register`, once per network)
  is still required — a built-in UID does not make an unregistered schema
  attestable. Unchanged by this design.

## Compatibility

Hosts that pass `data-schema-uid` (including the currently deployed site)
keep working via the override path. No consumer breaks.

## Out of scope

Mock mode, network resolution (`?mode=testnet`), `PUBLIC_*_RPC_URL`,
deploy-widget.yml.
