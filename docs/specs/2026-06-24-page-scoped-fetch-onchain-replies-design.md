# Page-scoped fetch + on-chain reply references

**Date:** 2026-06-24
**Status:** Approved (design)
**Supersedes on-chain format:** requires a new EAS schema registration (breaking; existing Sepolia test comments are discarded)

## Problem

The widget's read query (`core/anno/read.ts`) filters EAS attestations by
`schemaId` and `revoked` only — **not by URL**. URL scoping happens client-side
in `commentsForUrl` (`core/anno/locate.ts`). Consequently every page load
downloads and ABI-decodes *every* comment for the whole schema (the entire site),
even when the current page has two comments.

This makes per-page cost **O(site-wide comment count)**: network payload, viem
ABI-decode, and downstream projection all scale with the total, not the page.
At ~1000 site-wide comments this is a noticeable, always-paid cost.

`urlCanonical` lives inside the ABI-encoded `data` blob, so it cannot be used in
the GraphQL `where` clause directly. The fix is to put a page join-key into an
EAS top-level indexed field and filter on it server-side.

## Goal

1. Make per-page fetch **O(page comment count)** by filtering on an indexed field.
2. Move reply threading from a `data`-blob field (`parentUid`) to EAS's native
   on-chain reference (`refUID`) — the canonical EAS mechanism for "this
   attestation references that one".

## Key constraint discovered

`EAS.sol` (lines 467–470) validates `refUID` on-chain:

```solidity
if (request.refUID != EMPTY_UID) {
    if (!isAttestationValid(request.refUID)) {
        revert NotFound();
    }
}
```

`refUID` **must** point to an existing attestation. A page-hash is not an
attestation UID, so `refUID` cannot hold the page key (it would revert). This
forces the allocation below: replies (which reference a real parent attestation)
use `refUID`; the page key uses `recipient` (which has no existence constraint).

## Field allocation (EAS indexed top-level fields)

| Purpose | Field | Value |
|---|---|---|
| Page scoping | `recipient` (address, 20 bytes) | `pageKey(urlCanonical)` = first 20 bytes of `keccak256(utf8(urlCanonical))`. Set on **every** attestation (top-level and reply). |
| Reply parent | `refUID` (bytes32) | Parent attestation UID for a reply; `EMPTY_UID` for a top-level comment. |

### Why `urlCanonical`, not the raw URL

The page key is derived from `urlCanonical` (output of `canonicalizeUrl`), **not**
`location.href`. Canonicalization strips tracking params, sorts query params,
drops the fragment, and trims a trailing slash, so two authors on the same page
produce the same key. Hashing the raw URL would split a page's bucket on
`?utm_source=…`, param order, `#hash`, etc. This must match the existing
client-side join key (`commentsForUrl` compares `urlCanonical`).

### 20-byte truncation safety

`recipient` is an address (20 bytes); `keccak256` is 32, so we truncate to the
first 20 bytes. Collision probability is ~2⁻¹⁶⁰ (negligible). As a safety net,
the client-side `commentsForUrl` exact `urlCanonical` string match is retained —
the server filter is the coarse pass, the client filter is the exact pass.
A hypothetical collision can only cause over-fetch, never cross-page leakage.

## Components

### New: `pageKey(urlCanonical)` — shared helper (`core/anno`)

```
pageKey(urlCanonical: string): `0x${string}`   // 20-byte address-shaped hex
```

Computed via viem `keccak256(toBytes(urlCanonical))`, then take the first 20
bytes. Called by **both** the write path (attest) and the read path (query
variable) so the keys are guaranteed identical. New unit tests assert
determinism and canonicalization agreement.

### Schema change (breaking — new EAS schema)

Remove `bytes32 parentUid` from `ANNO_SCHEMA` (`core/anno/constants.ts`); reply
linkage moves on-chain to `refUID`.

- Re-run `site/scripts/register-anno-schema.ts` → new `schemaUid`.
- Update `PUBLIC_EAS_ANNO_SCHEMA_UID` in `site/.env` and the embed's
  `data-schema-uid`.
- Drop `parentUid` from `ANNO_ABI` (`core/anno/encode-defs.ts`), `decodeAnno`
  (`core/anno/schema.ts`), and the `AnnoFields` interface.

This is the only operationally heavy step (deployer key + gas). Acceptable
because existing test comments are being discarded.

### Write path

- `attestComment(signer, schemaUid, encodedData, { recipient, refUID })` —
  extend the signature. `recipient = pageKey(fields.urlCanonical)`;
  `refUID = parentUid ?? EMPTY_UID`.
- `app.tsx`: a reply no longer writes `parentUid` into `AnnoFields`; it passes
  the parent UID as `refUID` to `attestComment`. Span inheritance (the reply
  reusing the parent's anchor) is unchanged.

### Read path

- GraphQL `where: { schemaId: { equals }, revoked: { equals: false },
  recipient: { equals: $pageAddr } }`; add `refUID` to the selection set.
- `fetchAnno(schemaUid, { pageKey, endpoint })` — accept the page key and pass
  it as the `recipient` query variable.
- `decodeAttestation`: source `parentUid` from the envelope (`a.refUID`), not
  from decoded `data`.
- `StoredAnno`: `parentUid` moves from `AnnoFields` to the envelope alongside
  `uid` / `attester` / `time`.

### Threading & display (mostly unchanged)

- `thread.ts buildThreads` reads `parentUid` / `uid` only; with `parentUid` now
  sourced from `refUID`, logic is unchanged. The `ZERO_UID` sentinel equals EAS
  `EMPTY_UID`, so top-level detection still works.
- `commentsForUrl` exact `urlCanonical` match retained as the safety net.

## Testing

- `pageKey`: determinism; same canonical page → same key; tracking-param /
  param-order / trailing-slash / fragment variants → same key.
- `fetchAnno`: with a mock `fetch`, sends the correct `recipient` variable and
  restores `refUID` → `parentUid` on decode.
- `buildThreads`: threads correctly when `parentUid` originates from `refUID`
  (reuse existing tests with refUID-sourced fixtures).

## Out of scope

- Migrating existing on-chain comments (discarded — testnet data).
- GraphQL pagination / cursoring (separate concern; page scoping alone removes
  the dominant cost). Revisit if a single page accumulates very many comments.
- Read-side rendering optimizations (list virtualization, fallback caching,
  click hit-test precompute) — tracked separately; not part of this change.
