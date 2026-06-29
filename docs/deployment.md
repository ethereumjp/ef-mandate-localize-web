# Deployment

The web app (`ef-mandate-localize-web`) is a static Astro build. Two targets:
a GitHub Pages **preview** (live today) and an **IPFS** destination (designed,
not yet implemented). Everything required lives under `apps/web/` — no
repo-root workflow or `.gitignore` changes are involved.

## Base path

The site's base path is environment-driven (`apps/web/astro.config.mjs`):

```js
base: process.env.BASE_PATH ?? "/ef-mandate-localize-jp",
```

All internal links go through `withBase()` (`src/lib/i18n.ts`), which normalizes
the trailing slash, so the language switcher, the brand link, and the embedded
widget script (`/annotation/embed.js`) all resolve correctly under any base.

| Target | `BASE_PATH` | Why |
|---|---|---|
| GitHub Pages project site | `/ef-mandate-localize-jp` (default) | served under a repo subpath |
| IPFS via ENS / subdomain gateway | `/` (root) | served at origin root |

## Comments data source

Comments are read from EAS on Sepolia via a fixed GraphQL endpoint
(`https://sepolia.easscan.org/graphql`), filtered by the schema UID. Set the UID
at build time so the widget is injected and queries real on-chain comments:

```
PUBLIC_EAS_ANNO_SCHEMA_UID=0x…   # required for real comments; empty disables the widget
PUBLIC_SEPOLIA_RPC_URL=…         # optional; only wallet writes use it (public default otherwise)
PUBLIC_MOCK_COMMENTS=1           # dev preview only — bundled mock fixtures instead of on-chain
```

Put these in `apps/web/.env` (gitignored); Astro bakes `PUBLIC_*` into the
static build. Reading comments needs neither a wallet nor a custom RPC — only the
schema UID. Writing (publishing a comment) needs a wallet connected to Sepolia.

## GitHub Pages (preview)

"Deploy from a branch" mode — no GitHub Actions workflow. A deploy
script builds the site and force-pushes the static output to an output-only
branch (`gh-pages` by default) on a remote (`fork` by default).

```
PUBLIC_EAS_ANNO_SCHEMA_UID=0x… pnpm --filter ef-mandate-localize-web deploy:pages
```

`scripts/deploy-pages.sh` builds (`pnpm build`, which also rebuilds the widget
embed), drops a `.nojekyll` so Pages doesn't hide Astro's `_astro/` directory,
and publishes `dist/` as a single fresh commit (no history kept on the branch).

One-time GitHub setup: repo **Settings → Pages → Build and deployment →
Source: "Deploy from a branch" → Branch: `gh-pages` / (root)**.

Override the target with `PAGES_REMOTE` / `PAGES_BRANCH` env vars.

URL: `https://yujiym.github.io/ef-mandate-localize-jp/` (Japanese at `/ja`).

This is a manual deploy — re-run the script to publish updates (no push-to-deploy).

## IPFS (designed, not yet implemented)

The build is already IPFS-portable. When we move to IPFS:

1. **Build for root:** `BASE_PATH=/ pnpm --filter ef-mandate-localize-web build`.
2. **Access via root-served gateways only:**
   - ✅ ENS (`name.eth.limo`), subdomain gateway (`<cid>.ipfs.dweb.link`),
     DNSLink domain root — the site sits at origin root, so the root-base
     absolute URLs resolve correctly.
   - ❌ Path gateways (`https://gateway/ipfs/<cid>/…`) — absolute paths break.
     Not supported; use a root-served access method instead.
3. **Pinning:** undecided (Storacha/web3.storage, Pinata, or a local `ipfs`
   node). Once chosen, add a `deploy:ipfs` script under `apps/web/` — its body
   depends on the service (e.g. `w3 up dist`, a Pinata upload, or `ipfs add -r
   dist`). Capture the resulting CID and point an ENS/DNSLink record at it.

### Open consideration for full decentralization

Reading comments currently depends on the hosted `sepolia.easscan.org` GraphQL
indexer, and writes use an RPC endpoint. The static site itself is fully
portable, but for a censorship-resistant deployment we may later replace the
GraphQL dependency with a direct RPC log scan or a self-hostable indexer. Not
required for the current preview.
