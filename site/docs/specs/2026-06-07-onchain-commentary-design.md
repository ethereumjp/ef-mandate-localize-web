# On‑chain Commentary Layer — Design

- **Date:** 2026-06-07
- **Status:** Draft for review
- **Branch:** `feat/commentary` (fork `yujiym/ef-mandate-localize-jp`; upstream `ethereumjp`)
- **Demo target:** Sepolia · **Production target:** Ethereum mainnet

## 1. Summary

Build a reading website for the EF Mandate localization that lets anyone:

- toggle between languages (EN / JA now; more later) — the UI chrome localizes to the selected language,
- toggle commentary on/off for clean reading, and
- leave **wallet‑authenticated commentary on a selected span of text**, recorded as an **EAS (Ethereum Attestation Service) attestation**.

Commentary must survive edits to the original and the translations through a robust, layered anchoring model. The site is statically built and can be published either via **GitHub Pages** (sources from a committed `config.json`) or, as the decentralized North Star, over **IPFS + ENS `contenthash`** (served at `…eth.limo`). Language sources are **configurable per language** so that other organizations can run their own translation in their own repository and still interoperate.

The first deliverable is a **working on‑chain demo on Sepolia** (D2), built on an architecture that scales to the production North Star described below.

## 2. Background & current state

- The repository is a Markdown localization of the EF Mandate. `source/en/chapters/` holds frozen English snapshots; `source/ja/chapters/` holds the Japanese translation. Chapters are **paragraph‑aligned** and matched by a two‑digit chapter number; `scripts/build.py` validates alignment and merges to `dist/`.
- The source of truth is **GitHub, versioned by commit**. The website builds from it; edits continue to arrive as PRs. This is unchanged.
- Today, contribution/commentary happens through GitHub issues/PRs with a typed taxonomy (`Question`, `Commentary`, `Critique`, `Localization note`, `Clarification`). We **reuse that taxonomy** for on‑chain commentary.
- This work is started as a **demo on a fork branch** because the approach is not yet approved upstream. It must not affect `ethereumjp`.

## 3. Goals & non‑goals

### Goals (North Star)

1. A clean bilingual reading experience with commentary as an optional overlay.
2. Commentary anchored precisely to a text span, robust to edits of original and translation.
3. Commentary as an immutable, verifiable, censorship‑resistant on‑chain record (EAS).
4. Configurable, federated per‑language sources; other orgs can self‑host from their own repo and still share the commentary commons.
5. Flexible delivery: **GitHub Pages** (`config.json`) or decentralized **IPFS + ENS `contenthash`**.

### Non‑goals for the demo (Phase 1)

- IPFS comment bodies (demo stores bodies inline in the attestation).
- Off‑chain‑attestation + on‑chain Merkle timestamping (a production cost optimization).
- ENS `translate:<lang>` record resolution (demo uses `config.json`).
- Mainnet deployment.
- Moderation/curation tooling and an orphan‑management admin UI.
- Languages beyond EN/JA.
- Gasless/account‑abstraction onboarding.

## 4. Terminology

- **Block** — a content unit of a chapter (paragraph or heading). The display and aggregation unit.
- **`blockId`** — a stable, content‑independent identifier for a block, e.g. `02-p7`. Defined on the English original and **mirrored** by every translation. The backbone of cross‑language addressing.
- **Span** — a substring within a block; the precise target of a comment.
- **Source** — a per‑language origin of Markdown (a repo+path+ref, or later an IPFS/ENS pointer).
- **`sourceId`** — a stable id for a source, namespacing comments per source+version.
- **Attestation** — an EAS record carrying a comment's pointer, integrity hashes, thread link, and (demo) body.
- **Projection** — the off‑chain, derived mapping of immutable attestations onto the *current* version of the text (where re‑anchoring happens). Computed at build time and/or client side; never mutates the attestation.

## 5. Architecture overview (North Star)

1. **Config‑driven sources (no hard‑coded org).** A committed **`config.json`** declares, per language, `{ lang, sourceId, type, repo, path, ref }`. On the IPFS+ENS target these may additionally be supplied or overridden by ENS **text records** `translate:<lang>` on the project's ENS name. The build resolves them, pulls each language's Markdown, and bakes an immutable snapshot.
2. **Universal coordinates.** `blockId` is defined on the English original; every translation mirrors the same `blockId`s (validated per chapter at build). Therefore `chapter` + `blockId` is a **language‑ and org‑independent address** for any paragraph.
3. **Per‑surface pointer with `sourceId`.** A comment targets a specific rendered surface: `(chapter, blockId, lang, sourceId)` plus a span. `sourceId` keeps "KO from org A" distinct from "KO from org B."
4. **Global commentary commons (default).** One shared EAS **schema UID** per chain. Any instance — the canonical site or an org's self‑hosted copy — reads/writes the same schema. Because coordinates are universal, a comment made on one instance appears on the others (filtered by `lang`/`sourceId` as desired). The frontend is a viewer; the commentary layer is a shared on‑chain commons. *(An org may opt out by registering a private schema UID; default is the shared commons.)*
5. **Decentralized delivery.** Static build → **IPFS** → ENS `contenthash` (served via `eth.limo`). Each deploy is an immutable snapshot pinned to specific `(sourceId, commit)` per language; re‑anchoring of existing comments is recomputed on each rebuild.

```
ENS name ──contenthash──> IPFS (static site snapshot)
   │
   ├─ text: translate:en ─> EF source (repo/path/ref)
   ├─ text: translate:ja ─> ethereumjp source
   └─ text: translate:ko ─> (other org) source
                                   │
   EAS (shared schema UID) <───────┴── comment commons keyed by chapter+blockId
```

## 6. Anchoring model (3‑layer pointer)

A pointer is deliberately redundant so it degrades gracefully.

**Layer 1 — logical address (should be stable across edits)**

| Field | Example | Meaning |
|---|---|---|
| `chapter` | `"02"` | Chapter number (shared across languages). |
| `blockId` | `"02-p7"` | Stable block id (not a line number). |
| `lang` | `"ja"` | Which surface the comment is about (original vs a translation are different targets). |
| `sourceId` | `keccak(source identifier)` | Which source/repo of that language. |

**Layer 2 — version pin (provenance + change detection)**

| Field | Example | Meaning |
|---|---|---|
| `sourceCommit` | git SHA (bytes32) | Version the comment was authored against (provenance/audit). |
| `blockHash` | `keccak256(normalized block text)` | Cheap, verifiable check of whether *this block* changed since authoring. |

**Layer 3 — span selector (precise location inside the block; W3C Web Annotation style)**

| Field | Role |
|---|---|
| `spanExact` | The selected substring (the quote). |
| `spanPrefix` / `spanSuffix` | A few characters of surrounding context — used for fuzzy re‑anchoring after edits. |
| `spanStart` / `spanEnd` | Code‑point offsets within the normalized block — fast path when unchanged. |

`spanStart/End` (fast) + `spanExact/Prefix/Suffix` (robust) mirror the Hypothes.is approach.

### Normalization (must be deterministic & specified)

Before hashing or computing offsets, block text is canonicalized:

- strip the `<!-- block: … -->` marker,
- Unicode **NFC**,
- normalize line endings to `\n` and collapse trailing whitespace,
- offsets are **Unicode code‑point** indices over this normalized text.

The same routine is used at authoring time (in the browser) and at projection time (build/client) so hashes and offsets agree across platforms.

## 7. EAS schema

Registered once per chain via the EAS `SchemaRegistry`; **revocable**. Demo (Sepolia) schema, body inline:

```
string  chapter
string  blockId
string  lang
bytes32 sourceId
bytes32 sourceCommit
bytes32 blockHash
uint32  spanStart
uint32  spanEnd
string  spanExact
string  spanPrefix
string  spanSuffix
string  contributionType   // Question | Commentary | Critique | Localization note | Clarification
bytes32 parentUID          // replied-to attestation UID; 0x0 for top-level
bytes32 bodyHash           // keccak256 of the body (always present)
string  body               // inline body (demo); empty in the prod variant
string  schemaVersion      // e.g. "1"
```

- **Author identity** = the attester (wallet) address; displayed as ENS name/avatar when available. No separate login.
- **Threads** via `parentUID`.
- **Recipient** = `0x0` (commentary is not addressed to a party).
- **Production variant** (separate schema UID): replace inline `body` with `string bodyURI` (IPFS) and keep `bodyHash`; optionally drop on‑chain attestations in favor of off‑chain attestations + periodic on‑chain Merkle timestamp (see §13).

## 8. On‑chain vs off‑chain split

- **On‑chain (EAS):** pointer (Layers 1–3) + `blockHash`/`bodyHash` integrity + thread structure + `contributionType`. The **immutable historical fact**.
- **Comment body:** inline in the attestation for the demo (free on Sepolia, fully on‑chain). Production moves the body to IPFS (content‑addressed) with `bodyURI` + `bodyHash`.
- **Projection (off‑chain):** the current‑version mapping; derived, never written back on‑chain.

## 9. Edit‑handling lifecycle (the core)

**Key separation: the attestation is immutable (on‑chain historical fact); "placing it on the current version" is a derived projection (off‑chain).** The on‑chain record always reads "a comment on block X, span Y, at commit Z"; it is never moved or rewritten.

When a new commit changes a chapter, the projection re‑evaluates each attestation for that `(chapter, lang, sourceId)`:

1. Find the block with the same `blockId` in the new version.
   - **Missing** (block deleted) → status **`orphaned`**: retained and tagged **"Comment for past version"**, surfaced in an "unanchored" panel, never silently moved.
2. Compare `blockHash`:
   - **Unchanged** → status **`anchored`**; offsets valid as‑is.
   - **Changed** → fuzzy re‑match the span using `spanExact` + `spanPrefix`/`spanSuffix`:
     - unique confident match → status **`re-anchored`**: shown at the new position and tagged **"Comment for past version"** (links to the original quoted text and the version it was authored against);
     - ambiguous / not found → status **`needs-review`**: retained and tagged **"Comment for past version"**, surfaced to humans for re‑placement.

**Version tagging.** A comment is never deleted on edit. Whenever its authored `blockHash` differs from the current block's hash, the comment is **retained and labeled "Comment for past version"**, linking to the exact version (`sourceCommit`) and the original quoted text (`spanExact`) it was written against. The label applies to `re-anchored`, `needs-review`, and `orphaned` alike; only `anchored` (hash unchanged) is untagged. This label is a **localized UI string** (§12), not stored on‑chain — e.g. in Japanese it reads 「過去のバージョンに対するコメント」.

The site renders comments on the current version via the projection, always carrying provenance. **Deletes/corrections** never rewrite history: use EAS **revoke** (hidden in UI, record persists) or **supersede** (a new attestation whose body references the prior UID).

## 10. `blockId` management (inline, auto‑managed)

- Markers live inline as HTML comments at the start of each block: `<!-- block: 02-p7 -->`. They are **invisible in every Markdown renderer** (including GitHub preview) and **stripped from build output**.
- **Auto‑managed:** a pre‑commit/build tool injects and normalizes ids by aligning to the English original, so translators write plain Markdown and never hand‑write ids (prettier‑like). New blocks get new ids; existing ids are preserved through prose edits and moves (the marker travels with the block).
- **English is the id authority.** Translations mirror EN's id set.
- **CI validation:** per chapter, every language must have the **same `blockId` set as EN**, with **no duplicates**; missing/extra/duplicate ids fail the build. This makes the markers self‑protecting and keeps federation diffable across repos.

## 11. Content pipeline & build

1. Resolve sources from `config.json` (and, on the IPFS+ENS target, optional ENS `translate:<lang>` records), pulling each language's Markdown at a pinned ref.
2. Normalize markers (auto‑inject/validate), parse chapters into blocks, validate cross‑language `blockId` parity.
3. For each `(chapter, lang, sourceId, blockId)` emit a static **`anchors.json`**: `{ blockId → { normalizedText, blockHash } }` plus paragraph order. This is what the client projection runs against (no backend needed).
4. Render the static reading site (all chapters, all configured languages).
5. (Deploy) publish `dist/` to IPFS; optionally set ENS `contenthash`.

**In-progress translations.** Localization is ongoing, so a translation may cover only some chapters. English is always fully marked (it is the id authority). A translation chapter is **aligned** only when its block count matches English; chapters that don't yet match (untranslated stubs or mid-edit) are treated as **pending** — left unmarked, excluded from `anchors.json`, and reported (not failed) by the parity check. The reading view falls back to English for pending chapters.

## 12. Frontend / UX

- **Reading view:** bilingual, content‑first; paragraph‑aligned. A **language toggle** switches the surface (EN/JA now).
- **Localized UI (i18n):** the UI chrome — toggles, panel titles, compose form, `contributionType` names, and status tags such as **"Comment for past version" → 「過去のバージョンに対するコメント」** — follows the **selected reading language** via a message catalog (EN/JA now), falling back to EN when a reading language has no catalog yet. On‑chain values (e.g. `contributionType` enums, hashes) are stored canonically; only their **display labels** are localized.
- **Commentary toggle (on/off):** off → clean reading (no gutter, no highlights). On → the overlay appears.
- **Gutter (the "C as container" primitive):** one marker per block (e.g. `💬 5`) in the margin — the Ghost‑in‑the‑Shell marginalia. Layout stays bounded by block count regardless of comment volume. Counts aggregate `anchored` + `re-anchored`.
- **Expand a block:** opens the **right drawer** (Hypothes.is‑style; bottom sheet on mobile) showing that block's threads, with the reading text still visible. Spans are highlighted inline (`anchored` solid; `re-anchored` dashed and badged **"Comment for past version"**), and **highlight ⇄ card are bidirectionally linked** (hover/click one to focus the other). `needs-review`/`orphaned` live in the drawer's separate panel (also tagged "past version"), not on the text.
- **Create a comment:** selecting a span shows a small **selection popover** ("💬 Comment"); choosing it opens the **composer** in the drawer (pick `contributionType`, write body) → connect wallet if needed → sign the EAS attestation (Sepolia) → optimistic render with a tx‑status toast.
- **Threads:** reply via `parentUID`. Author shown as ENS/address.
- **Cross‑language affordance (optional):** because `chapter+blockId` is universal, a block may show "N comments on other languages" and let the reader peek.

### UI modules & overlay patterns

**Layout.** Hypothes.is‑style: a docked **right drawer** is the commentary surface, with the reading content always visible to its left; it collapses to a **bottom sheet** on mobile. Full‑screen modals are avoided so the referenced text stays in view.

**Modules**
- *Chrome (persistent):* `Toolbar` (language toggle · commentary on/off · wallet) · `ConnectButton`/`WalletMenu` (popover) · `NetworkBanner` (wrong‑network prompt).
- *Reading:* `ChapterReader`/`BlockRenderer` (paragraph‑aligned, owns text selection) · `Gutter`+`CommentBadge` (per‑block `💬 n`) · `SpanHighlight` (anchored solid / past‑version dashed).
- *Commentary:* `SelectionToolbar` (popover) · `Composer` (drawer; `contributionType` select + body) · `ThreadView` (drawer; threaded cards) · `ReplyComposer` (inline) · `CommentCard` (quote excerpt `spanExact` · ENS/avatar · type chip · body · time · past‑version tag · reply/revoke).
- *Status & provenance:* `AnchorStatusBadge` · `ProvenancePopover` (authored version `sourceCommit` + original quote) · `UnanchoredPanel` (needs‑review / orphaned).
- *Feedback:* `TxToast` (awaiting‑signature → pending → confirmed/failed) · `Skeleton` / `EmptyState` / `ErrorState` · `Tooltip`.

**Overlay patterns**

| Pattern | Used for |
|---|---|
| **Popover** (light, anchored) | selection toolbar, provenance peek, wallet menu |
| **Drawer** (non‑blocking; **bottom sheet** on mobile) | composer, thread view |
| **Toast** | transaction status |
| **Modal** (small dialog, *sparingly*) | revoke confirmation, first‑run onboarding |

**Implementation.** Tailwind for styling + **Base UI** headless components — `Popover`/`Dialog`/`Tooltip`/`Menu` — with **Floating UI** for the selection‑anchored adder (a virtual element over the DOM Range). Headless primitives provide focus‑trapping, ARIA, and positioning at minimal dependency cost; the drawer is a styled non‑blocking `<aside>` (bottom sheet via a small drawer lib on mobile).

## 13. Tech stack

Wallet state via **wagmi**; **ethers** is used only where the EAS SDK needs a signer, bridged with wagmi's official ethers adapter (https://wagmi.sh/react/guides/ethers). No wallet‑UI framework (custom connect button, no RainbowKit).

- **Astro** — static, content‑first, with interactive **React islands** (React is required by wagmi) for the commentary layer; deploys cleanly to IPFS (no server).
- **Tailwind CSS** — styling via Astro's Tailwind integration; utility‑first, no styled component kit.
- **Base UI + Floating UI** — accessible **headless** components (popover / dialog / tooltip / menu) and selection‑anchored positioning; Tailwind‑styled (see §12).
- **wagmi (+ viem)** — wallet connection, account/chain switching, and ENS state via React hooks; a small **custom connect button** (no RainbowKit). WalletConnect/mobile wallets are deferred (added later via wagmi connectors).
- **ethers v6 via wagmi's adapter** — per [wagmi.sh/react/guides/ethers](https://wagmi.sh/react/guides/ethers): `useEthersSigner` (wraps `useConnectorClient`, returning a v6 `BrowserProvider`/`JsonRpcSigner`) and `useEthersProvider` (wraps `useClient`) convert wagmi's viem clients to ethers — used **only** to feed the EAS SDK.
- **EAS SDK** (`@ethereum-attestation-service/eas-sdk`, ethers‑based) — `eas.connect(signer)` with the adapted ethers signer; build, encode, and submit attestations; decode on read.
- **EAS GraphQL API** — read attestations by schema UID via plain `fetch`; run the projection against the baked `anchors.json` (no extra dependency). Fallback: index attestation logs directly from chain (viem) if GraphQL is unavailable.
- **Shared TS re‑anchoring module** — pure functions (normalize, hash, fuzzy match, classify status); usable in the browser and at build; unit‑tested.
- Fully static + client‑side; no backend, so it runs from an IPFS snapshot.

## 14. Federation model

- `sourceId = keccak256(canonical source identifier)`, where the identifier is the source's ENS name (preferred) or a normalized repo URL.
- **Config:** a committed `config.json` manifest (both targets). On the IPFS+ENS target, ENS `translate:<lang>` text records resolve to the same shape.
- **Onboarding another org:** fork the open site code, point `translate:<lang>` at their repo (EN‑aligned `blockId`s), deploy their own IPFS+ENS instance — *or* be added to the canonical name's records. Either way, comments interoperate because the schema UID and coordinates are shared.

## 15. Delivery (two supported targets)

The same static build can be published either way; the target is a deployment choice, not an architectural one. Both are first‑class and selectable per instance — an org may start on Pages and later move to IPFS+ENS without changing the build.

**Sources config (baseline, both targets):** a committed **`config.json`** holds the source manifest (`{ lang, sourceId, type, repo, path, ref }`) plus site settings. On the IPFS+ENS target, ENS `translate:<lang>` text records may additionally supply or override sources.

**Target A — GitHub Pages (simplest; for demo).**
- A GitHub Actions workflow builds and publishes `dist/` to Pages.
- Sources come from `config.json`.
- No IPFS pinning or ENS name required. Centralized on GitHub, but zero‑friction.

**Target B — IPFS + ENS (decentralized; production).**
- Build → static `dist/` → upload to IPFS (e.g. kubo / Pinata / web3.storage) → obtain CID.
- Set the project ENS name's `contenthash` to `ipfs://<CID>`; served at `<name>.eth.limo`.
- Sources from `config.json` and/or ENS `translate:<lang>` records.
- Each deploy is an immutable snapshot; updates ship as a new CID + `contenthash` update.

## 16. Demo scope (Phase 1 — D2 on Sepolia)

Concrete, buildable milestones:

- **M1 — Content pipeline & markers:** marker auto‑injection/normalization tool, block parser, cross‑language parity + uniqueness CI, `anchors.json` emission. (No chain.)
- **M2 — Reading site:** Astro bilingual reading view, EN/JA toggle, commentary on/off shell, **localized UI chrome (EN/JA via a message catalog)**, all 8 chapters.
- **M3 — Re‑anchoring module:** the shared TS library + tests; demonstrate `anchored`/`re-anchored`/`orphaned`/`needs-review` by intentionally editing chapter 02.
- **M4 — Wallet + EAS write:** connect wallet (Sepolia), span‑select → compose → attest on‑chain, optimistic render.
- **M5 — EAS read + projection:** query attestations by schema UID, project to current version, gutter badges, threads, anchor‑status indicators; seed sample comments on chapter 02.
- **M6 — Deploy:** publish via the chosen target — **GitHub Pages** by default (sources from `config.json`), with the **IPFS+ENS** path also wired (build → IPFS CID; ENS `contenthash` optional in the demo).

Demo content: all 8 chapters in the reading view; sample comments seeded on chapter 02. Sources configured via `config.json` (EN + JA).

## 17. Deferred / future decisions

- **Mainnet cost model:** pure on‑chain attestations vs **off‑chain attestations + periodic on‑chain Merkle timestamp** (verifiable, censorship‑evident, far cheaper, better UX for high‑volume casual commentary). Decide before mainnet.
- **Body storage in production:** IPFS pinning/persistence for bodies; `bodyURI` (`ipfs://`) + `bodyHash` schema variant.
- **ENS `translate:<lang>`** record resolution and the canonical project ENS name.
- **Moderation/curation** at the view layer over a permissionless commons (spam/abuse, especially on mainnet).
- **Languages beyond EN/JA** (content sources and their UI message catalogs). The i18n mechanism itself is in scope for EN/JA.
- **Orphan/needs‑review admin tooling.**

## 18. Risks & open questions

- EAS GraphQL availability/rate limits on Sepolia → fallback to direct log indexing via viem.
- Wallet friction (testnet ETH/faucet, gas even on Sepolia) → consider gasless later.
- Fuzzy re‑anchor false positives → conservative confidence threshold; prefer `needs-review` over a wrong match.
- Marker auto‑injection when a translation's paragraph count temporarily diverges from EN mid‑edit → CI gate + clear errors.
- IPFS pinning/persistence and ownership of the canonical ENS name.
- Privacy/permanence: wallet address ↔ identity; comments are public and immutable by design.

## 19. Testing strategy

- **Unit:** normalization, hashing, fuzzy matcher, status classification (table‑driven, incl. Japanese text and edge cases).
- **Pipeline:** marker injection idempotency; parity/uniqueness CI on fixtures with intentional violations.
- **Projection:** golden tests — author a comment against v1, edit the block, assert the resulting status and re‑anchored offsets.
- **E2E (demo):** connect a Sepolia wallet, post a comment, see it projected onto the current version with the correct gutter/highlight.
