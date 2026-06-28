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
