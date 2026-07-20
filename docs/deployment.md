# Deployment & distribution

This repo ships **two artifacts with different lifecycles**:

- **The site** — `apps/web` (`ef-mandate-localize-web`): a static build, deployed to **IPFS**
  and exposed under a stable **IPNS** name. See [Part 1](#part-1--the-site).
- **The widget** — `@anno/widget`: a reusable embed bundle that *other* sites load with a
  `<script>` (npm/CDN, and IPFS/IPNS). See [Part 2](#part-2--the-widget).

They share IPFS mechanics; where the site and the widget differ — notably IPFS gateway
support — it's called out. The [decentralization note](#decentralization-note) at the end
applies to both.

---

# Part 1 — The site

`ef-mandate-localize-web` is a static Astro build, served at **root** (`base: "/"`). Deploy =
publish the static output to **IPFS**, pin it, and expose it under a stable **IPNS** name.
Everything required lives under `apps/web/`.

## Build

```bash
pnpm run build:web        # → apps/web/dist/  (root-relative; also rebuilds the widget embed)
```

`PUBLIC_ANNO_WIDGET_URL` is **baked in at build time** — set it in `apps/web/.env` (see
[`.env.example`](../apps/web/.env.example)) to point the site at a hosted widget bundle instead
of the same-origin copy; rebuild after changing it. `SITE_URL` is optional (canonical / OG
absolute URLs). `PUBLIC_MOCK_COMMENTS=1` builds with bundled mock comments (no chain).

## Publish to IPFS / IPNS

Protocol-level steps — any IPFS pinning service or node works; shown with the `ipfs` CLI:

```bash
cid=$(ipfs add -Qr --cid-version 1 apps/web/dist)   # add the dist/ directory → CID
ipfs pin add "$cid"                                  # (or pin via your service)
ipfs name publish "/ipfs/$cid"                       # → stable IPNS name; re-run each deploy
```

- **Access via a root-served gateway only** — a subdomain gateway (`<ipns>.ipns.dweb.link`)
  or a DNSLink domain root. **Not** path gateways (`…/ipns/<name>/…`): the site uses absolute
  paths, which break under a subpath. (The widget, Part 2, has no such limitation.)
- Optionally front the IPNS name with an **ENS `contenthash`** for a human-readable address.

## Networks (mainnet / Sepolia)

The site defaults to **mainnet**. Append **`?mode=testnet`** to any page URL to use
**Sepolia** (demo / local dev) — one build serves both; the widget resolves the network
client-side (`@anno/core/chain`).

Register the EAS schema **once per network** (the same schema string yields the same UID on
every chain):

```bash
NETWORK=mainnet EAS_PRIVATE_KEY=0x… pnpm --filter ef-mandate-localize-web anno:schema:register
NETWORK=sepolia EAS_PRIVATE_KEY=0x… pnpm --filter ef-mandate-localize-web anno:schema:register
```

To register from a **Safe multisig** instead, run `anno:schema:calldata` (no key, no RPC) —
it prints the deterministic UID and the `register(...)` call (`to` / `data`) to submit from
the Safe's Transaction Builder. The UID is identical either way (EAS schema registration is
caller-independent, so the registrant address doesn't affect it):

```bash
NETWORK=mainnet pnpm --filter ef-mandate-localize-web anno:schema:calldata
```

The widget ships this UID as its built-in default — registration is the only per-chain step.
Reads go through the network's EAS GraphQL endpoint (no wallet/RPC needed); publishing a
comment needs a wallet on the active network. Custom RPCs are optional
(`PUBLIC_MAINNET_RPC_URL`, `PUBLIC_SEPOLIA_RPC_URL`; public defaults otherwise).

> The site bundles the widget **same-origin** (`embed:build` copies it into
> `public/annotation/`), so it ships inside the site's own IPFS deploy. To host the widget
> independently and embed it from its own URL instead, see Part 2.

---

# Part 2 — The widget

How to host `@anno/widget` so any site can load it with a single `<script>`. The npm → CDN
path and the IPFS / ENS path serve different audiences and are meant to be used **together**.

## The artifact

`pnpm --filter @anno/widget build` produces a self-contained browser bundle in `dist/`:

| File | What it is |
|---|---|
| `embed.js` | The tiny loader (~56 kB). This is what a host page's `<script>` points at. |
| `app-<hash>.js` | The React app chunk (~1.8 MB), **lazy-loaded on first open**. |
| `ccip-<hash>.js` | A small wallet/CCIP helper chunk. |

The loader pulls the app chunk with a **relative** dynamic import — `import("./app-<hash>.js")`
— which the browser resolves against `embed.js`'s own URL. Two consequences:

- **Ship the whole `dist/` directory, co-located.** You cannot drop `embed.js` alone on an
  arbitrary path; its sibling chunks must sit next to it at the same URL prefix.
- **Host-agnostic otherwise.** Because the import is relative (not an absolute/base path), it
  resolves correctly behind same-origin hosting, any CDN directory, and **every** IPFS
  gateway shape — subdomain, ENS, **and** path gateways. (Unlike the site in Part 1, the
  widget has no path-gateway limitation.)

Everything else (React, wagmi/viem, ethers, the EAS SDK, `@anno/core`) is bundled in, so the
published package has **no runtime dependencies** — a `<script>` consumer fetches one file
(plus the lazy chunk) and nothing else.

## Where to host

| Context | Where | Why |
|---|---|---|
| **This project's own site** (`apps/web`) | **Same-origin self-host** — `embed:build` copies `dist/` into `apps/web/public/annotation/`, served at `/annotation/embed.js` | Zero third-party runtime dependency; works when the site itself is on IPFS. Already wired — nothing to do. |
| **Third-party adopters, convenience** | **CDN** via npm → jsDelivr/unpkg | One-line drop-in, global edge cache, immutable versioned URLs, SRI. |
| **Third-party adopters, censorship-resistance** | **IPFS** pinned, addressed by **ENS contenthash / IPNS** | Decentralized, content-addressed integrity, aligns with the project's ethos. |

Pick CDN **and** IPFS for public distribution: CDN for reach/latency/DX, IPFS/ENS for a
durable censorship-resistant address.

## CDN — publish to npm, serve via jsDelivr / unpkg

The package is configured for publishing (`packages/widget/package.json`): public access,
`files: ["dist"]`, `exports` → `dist/embed.js`, and a `prepack` that rebuilds. Publishing is
a manual, authenticated step — it is **not** automated here.

```bash
npm login                                   # one-time, an account that can publish @anno/*
pnpm --filter @anno/widget publish          # prepack rebuilds dist/, then publishes
```

> The npm scope `@anno` must exist and allow your account. `publishConfig.access: "public"`
> makes the scoped package public. Bump `version` for every release (see Versioning).

Once published, jsDelivr and unpkg serve it automatically — **no upload step**:

```html
<!-- jsDelivr, pinned to an exact, immutable version -->
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@anno/widget@0.1.0/dist/embed.js"
  data-schema-uid="0x…"
></script>

<!-- unpkg equivalent -->
<script type="module" src="https://unpkg.com/@anno/widget@0.1.0/dist/embed.js" data-schema-uid="0x…"></script>
```

The lazy `app-<hash>.js` chunk is fetched from the same versioned directory automatically.

## IPFS / ENS

Content-address the **whole `dist/` directory** so the chunks stay co-located:

```bash
pnpm --filter @anno/widget build
ipfs add -r --cid-version 1 packages/widget/dist
# → note the directory CID (the last line); pin it (any IPFS pinning service or node)
```

Embed via the **directory** CID so `embed.js` and its chunk resolve together:

```html
<!-- subdomain gateway -->
<script type="module" src="https://<dirCID>.ipfs.dweb.link/embed.js" data-schema-uid="0x…"></script>
<!-- or a path gateway — also fine for the widget -->
<script type="module" src="https://ipfs.io/ipfs/<dirCID>/embed.js" data-schema-uid="0x…"></script>
```

A new build = a new CID. For a **stable** embed URL that survives version bumps, point a
mutable name at the latest CID:

- **ENS `contenthash`** → `ipfs://<dirCID>`, then embed from `https://<name>.eth.limo/embed.js`.
- **IPNS** → `ipfs name publish /ipfs/<dirCID>`, then embed from `https://<ipnsName>.ipns.dweb.link/embed.js`.

Notes:
- The gateway must send permissive **CORS** for a cross-origin ES module + dynamic import;
  the common public gateways (dweb.link, ipfs.io, `*.eth.limo`) do.
- Mutable names (ENS/IPNS) trade content-addressed integrity for convenience — see below.

## Integrity & versioning

- **Pin, never float.** In an embed that lives on other people's pages, pin an **exact**
  version (`@0.1.0`) or an **exact CID**. Avoid `@latest` / a bare ENS name in production: a
  breaking change would propagate to every embedder at once.
- **Subresource Integrity (SRI)** can be added to the loader:
  ```bash
  openssl dgst -sha384 -binary packages/widget/dist/embed.js | openssl base64 -A
  # <script … integrity="sha384-…" crossorigin="anonymous">
  ```
  Caveat: SRI on the `<script>` covers **`embed.js` only** — the browser does not apply it to
  the dynamically-imported `app-<hash>.js` chunk. Chunk integrity therefore relies on the
  host being immutable: a pinned jsDelivr `@version` is immutable, and an IPFS **CID** is
  content-addressed (integrity for free). Prefer those over a mutable name when integrity
  matters.
- **Releases:** bump `packages/widget/package.json` `version` (semver), rebuild, then publish
  to npm and/or re-pin to IPFS and update the ENS/IPNS pointer. Embedders opt in by changing
  the version/CID in their `<script>`.

## Configuration attributes

The `<script data-*>` attributes (`data-schema-uid`, `data-network`, `data-mock`, …) are
documented in [`packages/widget/README.md`](../packages/widget/README.md). They are read on
the host page, so a hosted bundle needs no per-embedder rebuild.

---

# Decentralization note

Applies to both artifacts. Reading comments depends on the hosted easscan GraphQL indexer
(per network), and writes use an RPC endpoint. The static site and the widget bundle are both
fully portable, but for a fully censorship-resistant deployment the GraphQL dependency could
later be replaced with a direct RPC log scan or a self-hostable indexer. Not required for the
demo.
