# Page-scoped fetch + on-chain reply references — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the widget's EAS read to the current page via an indexed `recipient` field, and move reply threading from a `data`-blob field (`parentUid`) to EAS's native on-chain `refUID`.

**Architecture:** Derive a 20-byte page key from `urlCanonical` and write it to each attestation's `recipient`, so the GraphQL query filters by page server-side (O(page) not O(site)). Replies set `refUID` to the parent attestation UID (EAS validates it exists on-chain); the `parentUid` field leaves the schema. A client-side `urlCanonical` exact-match stays as a safety net against the 20-byte truncation.

**Tech Stack:** TypeScript, viem (keccak256/address helpers), `@ethereum-attestation-service/eas-sdk` (write only), EAS GraphQL (Sepolia), vitest, pnpm workspaces.

## Global Constraints

- All commands run from the monorepo root `commentary/` (the package.json with `pnpm -r test` lives there).
- Package names: `@commentary/core`, `@commentary/widget`.
- The read path must stay free of `eas-sdk`/`ethers` (decode uses viem only); the write path keeps `eas-sdk`.
- Page key derives from `urlCanonical` (output of `canonicalizeUrl`), never the raw URL.
- `EMPTY_UID` = `"0x" + "00".repeat(32)` (matches EAS `EMPTY_UID` and the existing `ZERO_UID` literals).
- This is a breaking on-chain format change; existing Sepolia test comments are discarded (no migration).
- Spec: `commentary/docs/specs/2026-06-24-page-scoped-fetch-onchain-replies-design.md`.

---

### Task 1: `pageKey()` helper + `EMPTY_UID` constant (core)

**Files:**
- Create: `core/src/anno/pageKey.ts`
- Modify: `core/src/anno/constants.ts` (add `EMPTY_UID`)
- Test: `core/tests/anno.pageKey.test.ts`

**Interfaces:**
- Produces: `pageKey(urlCanonical: string): \`0x${string}\`` — a checksummed 20-byte address-shaped hex. `EMPTY_UID: string` exported from `core/src/anno/constants.ts`.

- [ ] **Step 1: Write the failing test**

Create `core/tests/anno.pageKey.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pageKey } from "../src/anno/pageKey";
import { canonicalizeUrl } from "../src/anno/canonicalUrl";

describe("pageKey", () => {
  it("is deterministic and address-shaped (0x + 40 hex)", () => {
    const k = pageKey("https://example.com/post");
    expect(k).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(pageKey("https://example.com/post")).toBe(k);
  });

  it("differs across distinct canonical pages", () => {
    expect(pageKey("https://example.com/a")).not.toBe(
      pageKey("https://example.com/b"),
    );
  });

  it("collapses tracking params / order / fragment to one key", () => {
    const u1 = canonicalizeUrl("https://example.com/post?utm_source=x&a=1").urlCanonical;
    const u2 = canonicalizeUrl("https://example.com/post?a=1#frag").urlCanonical;
    expect(pageKey(u1)).toBe(pageKey(u2));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @commentary/core test tests/anno.pageKey.test.ts`
Expected: FAIL — cannot resolve `../src/anno/pageKey`.

- [ ] **Step 3: Write the implementation**

Create `core/src/anno/pageKey.ts`:

```ts
import { keccak256, stringToBytes, slice, getAddress } from "viem";

/**
 * EAS `recipient` page bucket: the first 20 bytes of keccak256(utf8(urlCanonical)),
 * checksummed to an address. Used as the indexed server-side page filter. MUST be
 * fed `urlCanonical` (not a raw URL) so two authors on the same page agree.
 */
export function pageKey(urlCanonical: string): `0x${string}` {
  return getAddress(slice(keccak256(stringToBytes(urlCanonical)), 0, 20));
}
```

Add to `core/src/anno/constants.ts`:

```ts
/** EAS empty reference UID (top-level comments; matches on-chain EMPTY_UID). */
export const EMPTY_UID = "0x" + "00".repeat(32);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @commentary/core test tests/anno.pageKey.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add core/src/anno/pageKey.ts core/src/anno/constants.ts core/tests/anno.pageKey.test.ts
git commit -m "feat(core): pageKey() page-bucket helper + EMPTY_UID"
```

---

### Task 2: Page-scoped fetch — `recipient` filter on read + `recipient` on write

Delivers the scaling win on its own. Replies still thread via the existing `data` `parentUid` (untouched here); Task 3 migrates them to `refUID`.

**Files:**
- Modify: `core/src/anno/read.ts` (query + `fetchAnno` opts)
- Modify: `widget/src/web3/eas.ts` (`attestComment` `recipient`)
- Modify: `widget/src/display.ts` (compute + pass `pageKey`)
- Modify: `widget/src/app.tsx` (pass `recipient` to `attestComment`)
- Test: `core/tests/anno.read.test.ts`

**Interfaces:**
- Consumes: `pageKey(urlCanonical)`, `EMPTY_UID` (Task 1).
- Produces:
  - `fetchAnno(schemaUid: string, opts?: { pageKey?: string; endpoint?: string; fetchImpl?: typeof fetch }): Promise<StoredAnno[]>`
  - `attestComment(signer, schemaUid: string, encodedData: string, opts: { recipient: string; refUID?: string }): Promise<string>`

- [ ] **Step 1: Write the failing test**

Create `core/tests/anno.read.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fetchAnno } from "../src/anno/read";

function mockFetch(captured: { body?: any }) {
  return (async (_url: string, init: { body: string }) => {
    captured.body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ data: { attestations: [] } }) };
  }) as unknown as typeof fetch;
}

describe("fetchAnno", () => {
  it("scopes the query to the page recipient", async () => {
    const cap: { body?: any } = {};
    await fetchAnno("0xschema", { pageKey: "0xPAGEADDR", fetchImpl: mockFetch(cap) });
    expect(cap.body.variables.schemaId).toBe("0xschema");
    expect(cap.body.variables.recipient).toBe("0xPAGEADDR");
    expect(cap.body.query).toContain("recipient: { equals: $recipient }");
  });

  it("returns [] for an empty schemaUid without fetching", async () => {
    const cap: { body?: any } = {};
    const out = await fetchAnno("", { pageKey: "0xPAGEADDR", fetchImpl: mockFetch(cap) });
    expect(out).toEqual([]);
    expect(cap.body).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @commentary/core test tests/anno.read.test.ts`
Expected: FAIL — query lacks `recipient: { equals: $recipient }` / `variables.recipient` undefined.

- [ ] **Step 3: Update `fetchAnno` to scope by recipient**

Replace the `QUERY` constant and `fetchAnno` body in `core/src/anno/read.ts`:

```ts
const EAS_GRAPHQL = "https://sepolia.easscan.org/graphql";

/** GraphQL query; scoped by `recipient` (the page key) when one is supplied. */
function buildQuery(scoped: boolean): string {
  return `query Comments($schemaId: String!${scoped ? ", $recipient: String!" : ""}) {
  attestations(
    where: { schemaId: { equals: $schemaId }, revoked: { equals: false }${
      scoped ? ", recipient: { equals: $recipient }" : ""
    } }
    orderBy: { time: asc }
  ) { id attester time revoked data }
}`;
}

/** Fetch + decode non-revoked anno attestations, scoped to a page when `pageKey` is set. */
export async function fetchAnno(
  schemaUid: string,
  opts: { pageKey?: string; endpoint?: string; fetchImpl?: typeof fetch } = {},
): Promise<StoredAnno[]> {
  if (!schemaUid) return [];
  const f = opts.fetchImpl ?? fetch;
  const scoped = Boolean(opts.pageKey);
  const variables = scoped
    ? { schemaId: schemaUid, recipient: opts.pageKey }
    : { schemaId: schemaUid };
  const res = await f(opts.endpoint ?? EAS_GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: buildQuery(scoped), variables }),
  });
  if (!res.ok) throw new Error(`EAS GraphQL ${res.status}`);
  const json = (await res.json()) as { data?: { attestations?: RawAttestation[] } };
  const rows = json.data?.attestations ?? [];
  return rows.map(decodeAttestation);
}
```

Leave the existing `RawAttestation` interface and `decodeAttestation` unchanged in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @commentary/core test tests/anno.read.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add `recipient` to the write path**

In `widget/src/web3/eas.ts`, replace `attestComment`:

```ts
import { EAS } from "@ethereum-attestation-service/eas-sdk";
import type { TransactionSigner } from "@ethereum-attestation-service/eas-sdk";
import { EAS_ADDRESS } from "@commentary/core/chain";
import { EMPTY_UID } from "@commentary/core/anno/constants";

/** Submit a comment attestation; resolves to the new attestation UID. */
export async function attestComment(
  signer: TransactionSigner,
  schemaUid: string,
  encodedData: string,
  opts: { recipient: string; refUID?: string },
): Promise<string> {
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(signer);
  const tx = await eas.attest({
    schema: schemaUid,
    data: {
      recipient: opts.recipient,
      expirationTime: 0n,
      revocable: true,
      refUID: opts.refUID ?? EMPTY_UID,
      data: encodedData,
    },
  });
  return await tx.wait();
}
```

The previous `ZERO_ADDR` constant is now unused — delete it.

- [ ] **Step 6: Pass the page key from the display refresh**

In `widget/src/display.ts`, add imports and update `refresh`:

```ts
import { pageKey } from "@commentary/core/anno/pageKey";
// canonicalizeUrl is already imported.
```

Replace the `refresh` body's fetch line:

```ts
async refresh() {
  if (opts.mock) {
    stored = loadMockComments();
  } else {
    const { urlCanonical } = canonicalizeUrl(location.href);
    stored = await fetchAnno(opts.schemaUid, {
      pageKey: pageKey(urlCanonical),
      endpoint: opts.easGraphql,
    });
  }
  project();
  paintHighlights();
},
```

- [ ] **Step 7: Pass `recipient` from the app submit**

In `widget/src/app.tsx`, add the import:

```ts
import { pageKey } from "@commentary/core/anno/pageKey";
```

In `handleSubmit`, replace the `attestComment(...)` call:

```ts
await attestComment(signer, config.schemaUid, encodeAnno(fields), {
  recipient: pageKey(fields.urlCanonical),
});
```

- [ ] **Step 8: Typecheck both packages**

Run: `pnpm --filter @commentary/core typecheck && pnpm --filter @commentary/widget typecheck`
Expected: PASS, no type errors.

- [ ] **Step 9: Run the full suites**

Run: `pnpm -r test`
Expected: PASS (all existing tests + the new read/pageKey tests).

- [ ] **Step 10: Commit**

```bash
git add core/src/anno/read.ts core/tests/anno.read.test.ts \
  widget/src/web3/eas.ts widget/src/display.ts widget/src/app.tsx
git commit -m "feat(commentary): page-scoped EAS fetch via recipient page key"
```

---

### Task 3: On-chain reply references (`refUID`) + drop `parentUid` from the schema

Atomic format change across both packages: `parentUid` leaves the `data` blob; reply linkage moves to the on-chain `refUID`, sourced back into `StoredAnno.parentUid` on read so `buildThreads` is unchanged.

**Files:**
- Modify: `core/src/anno/constants.ts` (`ANNO_SCHEMA`)
- Modify: `core/src/anno/encode-defs.ts` (`ANNO_ABI`)
- Modify: `core/src/anno/schema.ts` (`AnnoFields`, `decodeAnno`)
- Modify: `core/src/anno/author.ts` (`DraftInput`, `buildAnnoFields`)
- Modify: `core/src/anno/locate.ts` (`StoredAnno`)
- Modify: `core/src/anno/read.ts` (`RawAttestation`, query selection, `decodeAttestation`)
- Modify: `widget/src/web3/eas.ts` (pass `refUID`)
- Modify: `widget/src/app.tsx` (reply via `refUID`, composer key)
- Modify: `widget/src/comments/Composer.tsx` (drop `parentUid` debug row)
- Test: `core/tests/anno.schema.test.ts`, `core/tests/anno.locate.test.ts`, `core/tests/anno.author.test.ts`, `core/tests/anno.read.test.ts`

**Interfaces:**
- Consumes: `EMPTY_UID` (Task 1), `attestComment(..., { recipient, refUID })` (Task 2).
- Produces:
  - `AnnoFields` no longer has `parentUid`.
  - `StoredAnno` adds `parentUid: string` in its envelope (alongside `uid`/`attester`/`time`), sourced from on-chain `refUID`.
  - `RawAttestation` adds `refUID: string`.

- [ ] **Step 1: Update the read test to assert `refUID → parentUid`**

Append to `core/tests/anno.read.test.ts`. This encodes `data` with viem (read-side only, no eas-sdk) so the test stays light:

```ts
import { encodeAbiParameters } from "viem";
import { ANNO_ABI } from "../src/anno/encode-defs";
import { decodeAttestation } from "../src/anno/read";

// Build attestation `data` from the (post-Task-3) ABI: no parentUid field.
function encodeData(over: Partial<Record<string, unknown>> = {}): `0x${string}` {
  const base: Record<string, unknown> = {
    url: "https://example.com/p",
    urlCanonical: "https://example.com/p",
    origin: "https://example.com",
    lang: "en",
    rootSelector: "p:nth-of-type(1)",
    containerHash: "0x" + "11".repeat(32),
    spanStart: 0,
    spanEnd: 3,
    spanExact: "abc",
    spanPrefix: "",
    spanSuffix: "",
    body: "hi",
    meta: "",
    ...over,
  };
  return encodeAbiParameters(
    ANNO_ABI,
    ANNO_ABI.map((p) => base[p.name]) as never,
  );
}

describe("decodeAttestation", () => {
  it("sources parentUid from the envelope refUID", () => {
    const parent = "0x" + "ab".repeat(32);
    const c = decodeAttestation({
      id: "0x" + "cd".repeat(32),
      attester: "0x0000000000000000000000000000000000000001",
      time: 1717000000,
      revoked: false,
      refUID: parent,
      data: encodeData(),
    });
    expect(c.parentUid).toBe(parent);
    expect(c.body).toBe("hi");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @commentary/core test tests/anno.read.test.ts`
Expected: FAIL — `RawAttestation` has no `refUID`; `ANNO_ABI` still contains `parentUid`; `decodeAttestation` does not set `parentUid` from `refUID`.

- [ ] **Step 3: Remove `parentUid` from the schema string**

In `core/src/anno/constants.ts`, set `ANNO_SCHEMA` to (no `bytes32 parentUid`):

```ts
export const ANNO_SCHEMA =
  "string url,string urlCanonical,string origin,string lang,string rootSelector,bytes32 containerHash,uint32 spanStart,uint32 spanEnd,string spanExact,string spanPrefix,string spanSuffix,string body,string meta";
```

- [ ] **Step 4: Remove `parentUid` from the ABI**

In `core/src/anno/encode-defs.ts`, delete this entry from `ANNO_ABI`:

```ts
  { name: "parentUid", type: "bytes32" },
```

(The array now runs `…spanSuffix`, then `body`, `meta`. `annoFieldDefs` maps over `ANNO_ABI`, so it updates automatically.)

- [ ] **Step 5: Remove `parentUid` from `AnnoFields` + `decodeAnno`**

In `core/src/anno/schema.ts`, delete `parentUid: string;` from the `AnnoFields` interface, and update `decodeAnno`'s return (re-indexed; `parentUid` gone):

```ts
  return {
    url: v[0],
    urlCanonical: v[1],
    origin: v[2],
    lang: v[3],
    rootSelector: v[4],
    containerHash: v[5],
    spanStart: Number(v[6]),
    spanEnd: Number(v[7]),
    spanExact: v[8],
    spanPrefix: v[9],
    spanSuffix: v[10],
    body: v[11],
    meta: v[12],
  };
```

- [ ] **Step 6: Drop `parentUid` from the author draft**

In `core/src/anno/author.ts`: delete the `ZERO_UID` constant, the `parentUid?` field from `DraftInput`, and the `parentUid: input.parentUid ?? ZERO_UID,` line from the returned object.

- [ ] **Step 7: Add `parentUid` to the `StoredAnno` envelope**

In `core/src/anno/locate.ts`, update the interface:

```ts
export interface StoredAnno extends AnnoFields {
  uid: string;
  attester: string;
  time: number; // unix seconds
  parentUid: string; // on-chain refUID; EMPTY_UID = top-level
}
```

- [ ] **Step 8: Source `parentUid` from `refUID` on read**

In `core/src/anno/read.ts`: add `refUID` to `RawAttestation`, to the GraphQL selection set, and to `decodeAttestation`:

```ts
export interface RawAttestation {
  id: string;
  attester: string;
  time: number;
  revoked: boolean;
  refUID: string;
  data: string;
}

export function decodeAttestation(a: RawAttestation): StoredAnno {
  return {
    uid: a.id,
    attester: a.attester,
    time: Number(a.time),
    parentUid: a.refUID,
    ...decodeAnno(a.data),
  };
}
```

In `buildQuery`, change the selection set to include `refUID`:

```ts
  ) { id attester time revoked refUID data }
```

- [ ] **Step 9: Pass `refUID` from the app submit**

In `widget/src/app.tsx`:

Add the import:

```ts
import { EMPTY_UID } from "@commentary/core/anno/constants";
```

In `replyFields`, delete the `parentUid: parent.uid,` line (the parent link no longer lives in the encoded data).

In `handleSubmit`, replace the submit call to pass `refUID`:

```ts
await attestComment(signer, config.schemaUid, encodeAnno(fields), {
  recipient: pageKey(fields.urlCanonical),
  refUID: parent ? parent.uid : EMPTY_UID,
});
```

Replace the `Composer` `key` (it referenced `composerFields?.parentUid`, now gone) with the reply target:

```tsx
          key={`${replyTo ?? ""}:${composerFields?.spanExact ?? "compose"}`}
```

- [ ] **Step 10: Drop the `parentUid` debug row in the composer**

In `widget/src/comments/Composer.tsx`, delete the two lines:

```tsx
            <dt>parentUid</dt>
            <dd className="truncate">{shortHex(fields.parentUid)}</dd>
```

- [ ] **Step 11: Update core fixtures that set `parentUid`**

In `core/tests/anno.schema.test.ts` (line ~17) and `core/tests/anno.locate.test.ts` (line ~23): delete the `parentUid: "0x" + "00".repeat(32),` line from the `AnnoFields` fixture. In `core/tests/anno.locate.test.ts`, if the object is used as a `StoredAnno`, add `parentUid: "0x" + "00".repeat(32),` alongside its `uid`/`attester`/`time` envelope fields instead (envelope, not data). In `core/tests/anno.author.test.ts` (line ~40), delete the `expect(fields.parentUid).toBe(...)` assertion.

- [ ] **Step 12: Run the read test, then typecheck both packages**

Run: `pnpm --filter @commentary/core test tests/anno.read.test.ts`
Expected: PASS (decodeAttestation + earlier fetchAnno tests).

Run: `pnpm --filter @commentary/core typecheck && pnpm --filter @commentary/widget typecheck`
Expected: PASS. (If a typecheck flags a stray `parentUid` reference, it is a real leftover — fix at the flagged site.)

- [ ] **Step 13: Run the full suites**

Run: `pnpm -r test`
Expected: PASS — all packages green.

- [ ] **Step 14: Commit**

```bash
git add core/src/anno/constants.ts core/src/anno/encode-defs.ts \
  core/src/anno/schema.ts core/src/anno/author.ts core/src/anno/locate.ts \
  core/src/anno/read.ts widget/src/web3/eas.ts widget/src/app.tsx \
  widget/src/comments/Composer.tsx \
  core/tests/anno.schema.test.ts core/tests/anno.locate.test.ts \
  core/tests/anno.author.test.ts core/tests/anno.read.test.ts
git commit -m "feat(commentary): thread replies via on-chain refUID; drop parentUid from schema"
```

---

### Task 4: Ops — regenerate mock fixture, register new schema, update env + embed

Manual / external steps (no unit-test cycle). Each is independently verifiable by the stated check.

**Files:**
- Modify: `site/scripts/gen-mock-comments.ts` (emit `refUID` on each raw attestation)
- Regenerate: `widget/src/anno/mock-comments.json` (via `pnpm gen:mock`)
- Update: `site/.env` (`PUBLIC_EAS_ANNO_SCHEMA_UID`) and the embed `<script data-schema-uid>`

- [ ] **Step 1: Make the mock generator emit `refUID`**

In `site/scripts/gen-mock-comments.ts`, each emitted raw attestation object (currently `{ id, attester, time, revoked, data }`) must gain `refUID`. For all current mock comments (none are replies) use `EMPTY_UID`:

```ts
// where each raw attestation is built, add:
refUID: ZERO_UID, // top-level mock comments reference nothing
```

(`ZERO_UID` is already defined in this file and equals `EMPTY_UID`.)

- [ ] **Step 2: Regenerate the fixture and verify it decodes**

Run: `pnpm gen:mock`
Then: `pnpm -r test`
Expected: `mock-comments.json` rewritten with the slimmer (no-`parentUid`) `data` and a `refUID` on each row; all tests still pass.

Commit:

```bash
git add site/scripts/gen-mock-comments.ts widget/src/anno/mock-comments.json
git commit -m "chore(commentary): mock fixture carries refUID; drop parentUid"
```

- [ ] **Step 3: Register the new EAS schema (deployer, Sepolia gas)**

The schema string changed, so the schema UID changes. With a funded Sepolia key:

Run: `SEPOLIA_PRIVATE_KEY=<funded key> pnpm --filter @commentary/site exec tsx scripts/register-anno-schema.ts`
(Use the project's existing invocation for `register-anno-schema.ts` if it differs — the script prints the new UID.)
Expected: console prints `anno schema UID: 0x…` — the new schema version.

- [ ] **Step 4: Wire the new schema UID through config**

- Set `PUBLIC_EAS_ANNO_SCHEMA_UID` in `site/.env` to the new UID (per the script's printed instruction).
- Update the embed loader's `data-schema-uid` attribute (the `<script>` tag that loads `embed.js`) wherever the site/docs reference the old UID.

Verify: load a page with the widget against the new schema, post a top-level comment and a reply, reload, and confirm both appear and the reply nests under its parent. Confirm the network request's GraphQL `variables.recipient` matches `pageKey(urlCanonical)` for the page.

- [ ] **Step 5: Commit config**

```bash
git add site/.env  # if tracked; otherwise update deployment env out-of-band
git commit -m "chore(commentary): point widget at new anno schema UID"
```

---

## Self-Review

**Spec coverage:**
- Page scoping via `recipient` → Task 2 (read filter + write recipient) + Task 1 (`pageKey`). ✓
- `refUID` reply references + `refUID` existence constraint → Task 3 (write `refUID`, read map). ✓
- `urlCanonical`-derived key (not raw URL) → Task 1 impl + test. ✓
- 20-byte truncation + client `commentsForUrl` safety net → `pageKey` truncates; `commentsForUrl` untouched (still runs in `display.ts` `project()`/`pageScoped()`). ✓
- Schema change / re-registration / env + embed update → Task 4. ✓
- Threading unchanged (`buildThreads`) → Task 3 sources `parentUid` from `refUID`; `thread.ts` untouched. ✓
- Tests: `pageKey` determinism/canonicalization (Task 1), `fetchAnno` recipient variable + `refUID→parentUid` (Tasks 2–3). ✓
- Out of scope (existing-data migration, pagination, render perf) → not planned, per spec. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. Task 4 Steps 3–4 are inherently manual (gas, deployer key, env) and state exact commands/checks rather than code. ✓

**Type consistency:** `pageKey(urlCanonical): \`0x${string}\`` used identically in `display.ts`, `app.tsx`, and tests. `attestComment(..., { recipient, refUID? })` introduced in Task 2, `refUID` filled in Task 3. `StoredAnno.parentUid` (envelope) replaces `AnnoFields.parentUid`; `decodeAttestation` sets it from `RawAttestation.refUID`. `EMPTY_UID` from `core/anno/constants` used in `eas.ts` and `app.tsx`. Consistent across tasks. ✓
