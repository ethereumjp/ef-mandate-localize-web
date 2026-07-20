# @anno/widget

A standalone, embeddable **on-chain annotation widget**. Add one `<script>` tag to any
site and readers can attach comments to the exact text span they select — each comment is
an [EAS](https://attest.org) attestation, anchored so it survives edits to the page. No
backend, no build step on the host site.

## Embed

Build produces a single ESM loader (`dist/embed.js`) that lazy-loads the React app on
first use. Drop it on any page — e.g. from the CDN (pin an exact version):

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@anno/widget@0.1.0/dist/embed.js"
></script>
```

Any static host works the same way (same-origin, CDN, or IPFS/ENS) as long as `dist/`'s
files stay co-located — see [Deployment & distribution, Part 2](../../docs/deployment.md#part-2--the-widget).

The loader injects a floating launcher pill plus a selection "Comment" popover, both inside
a shadow root (no style bleed into the host page).

### Configuration (`data-*` attributes)

| Attribute          | Required | Default                          | Notes |
|--------------------|----------|----------------------------------|-------|
| `data-schema-uid`  | No       | built-in canonical anno schema UID | Override to read/write a different EAS schema. |
| `data-network`     | No       | `mainnet`                        | Target network (`mainnet` or `sepolia`). `?mode=testnet` in the URL forces `sepolia`. |
| `data-rpc`         | No       | public node                      | Sepolia JSON-RPC endpoint (write path). |
| `data-mainnet-rpc` | No       | public node                      | Mainnet JSON-RPC endpoint (write path / ENS). |
| `data-eas-graphql` | No       | network default                  | EAS GraphQL read endpoint (defaults to the network's endpoint). |
| `data-position`    | No       | `bottom-right`                   | Launcher corner: `bottom-right` or `bottom-left`. |
| `data-lang`        | No       | `<html lang>` then `en`          | UI language. |
| `data-mock`        | No       | off                              | `1`/`true` uses bundled mock comments (demo, no chain calls). |

## Develop

```bash
pnpm --filter @anno/widget build       # Vite → dist/embed.js + lazy app chunk
pnpm --filter @anno/widget test        # Vitest unit tests
pnpm --filter @anno/widget typecheck   # tsc --noEmit
pnpm --filter @anno/widget serve:test  # static server on :5180 (requires python3)
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

`@anno/widget` builds and ships independently of `apps/web`. The web app simply copies the
built `dist/` into its served `public/annotation/` (see the web app's `embed:build` script),
but any static host can serve `embed.js` the same way.
