# M4 — Wallet + EAS Write Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reader connect a wallet (Sepolia), select text in a block, compose a typed comment, and publish it as an **EAS attestation on Sepolia**, with optimistic rendering — reusing the M1/M3 anchoring modules in the browser.

**Architecture:** One React island (`client:load`) hosting `WagmiProvider` + React Query; it portals a wallet button into the toolbar and comment UI into the per-block gutters of the existing static Astro DOM. Anchors are built **in the browser from the rendered selection** (block element `textContent` → M1 `normalizeBlockText` → M1 `blockHash` → M3 `makeAnchor`). The comment is encoded with the EAS `SchemaEncoder` and submitted via the EAS SDK using an ethers v6 signer obtained from wagmi's adapter. The schema is registered once on Sepolia (its UID lives in env).

**Tech Stack:** React 19 + `@astrojs/react`; `wagmi` v2 + `viem` + `@tanstack/react-query`; `ethers` v6 (via wagmi's ethers adapter) + `@ethereum-attestation-service/eas-sdk`; `@base-ui-components/react` + `@floating-ui/react`; vitest (jsdom for the selection test). Reuses M1 `normalize`/`hash` and M3 `anchoring`.

---

## Reality check (read first)

- **The on-chain path cannot run in CI.** Connecting a wallet and attesting needs a browser extension wallet + Sepolia ETH. So: the **deterministic modules are unit-tested** (schema encode/decode, selection→offset, anchor build), and the **wallet/compose/attest UI is verified by `pnpm build` + `pnpm run check:astro` + a manual demo checklist** (Task 9). Don't fake on-chain tests.
- **API drift:** `wagmi` v2, the EAS SDK, and Base UI have specific, evolving APIs. For the React/EAS tasks, **verify the exact signatures against the installed package versions** (read `node_modules/<pkg>/dist/*.d.ts` or the package README) before finalizing; the code below is the intended shape, not a guarantee of every current signature.
- **Anchor text basis (decided):** live comments anchor over the **rendered, normalized block text** the reader selects (`blockEl.textContent` → `normalizeBlockText`), hashed with M1 `blockHash`, offsets from M3. This is independent of M1's markdown `anchors.json` (which stays the build-pipeline artifact). Author (M4) and projection (M5) both use this browser-side basis.

## External setup (done once by a human — not CI)

1. A **Sepolia wallet** (MetaMask/Rabby) with **faucet ETH** (e.g. a Sepolia faucet).
2. **Register the schema:** `SEPOLIA_PRIVATE_KEY=0x… PUBLIC_SEPOLIA_RPC_URL=… pnpm run schema:register` (Task 4) → prints the **schema UID**. (Or register the same schema string at easscan.org's Sepolia SchemaRegistry UI.)
3. Put the result in `site/.env`: `PUBLIC_EAS_SCHEMA_UID=0x…` and optionally `PUBLIC_SEPOLIA_RPC_URL=…` (else a public RPC default is used). `.env` is gitignored.

## File structure (created under `site/`)

- `src/web3/constants.ts` — Node-safe constants (EAS addresses, schema string, Sepolia chain id)
- `src/web3/config.ts` — browser wagmi config (Sepolia, injected, RPC) + schema UID from `import.meta.env.PUBLIC_*`
- `src/web3/ethers.ts` — `useEthersSigner` (wagmi → ethers v6 adapter)
- `src/web3/schema.ts` — `SCHEMA`, `CommentInput`, `encodeComment`, `decodeComment` (pure)
- `src/web3/selection.ts` — `normalizedBlockText`, `selectionToOffsets`, `anchorFromSelection` (browser; reuses M1/M3)
- `src/web3/eas.ts` — `attestComment(signer, schemaUid, encoded, parentUid)` (thin runtime wrapper)
- `src/web3/types.ts` — `ContributionType`, `Comment`
- `scripts/register-schema.ts` — one-time schema registration CLI (Node, private key)
- `src/components/comments/CommentApp.tsx` — root island: providers + portals + selection handler + optimistic store
- `src/components/comments/ConnectButton.tsx` — wallet connect/disconnect/account/Sepolia guard
- `src/components/comments/SelectionPopover.tsx` — "Comment" affordance on selection (Floating UI)
- `src/components/comments/Composer.tsx` — Base UI dialog (type + body) → attest
- `src/components/comments/CommentMarker.tsx` — optimistic per-block gutter badge/thread

Modified: `astro.config.mjs` (react integration), `site/package.json` (deps + scripts + lint/fmt globs), `src/components/Toolbar.astro` (`#wallet-slot`), `src/components/Document.astro` (mount `<CommentApp client:load>`), `.gitignore` (`.env`), `site/README.md`, `.github/workflows/site-checks.yml` (unchanged checks still pass).

---

## Task 1: Web3 + React scaffold

**Files:** Modify `site/package.json`, `site/astro.config.mjs`, `.gitignore`; Create `site/.env.example`, `site/src/web3/config.ts`, `site/src/web3/types.ts`, `site/src/components/comments/CommentApp.tsx`.

- [ ] **Step 1: Install deps** (from `site/`)
```bash
pnpm add @astrojs/react react react-dom wagmi viem @tanstack/react-query ethers @ethereum-attestation-service/eas-sdk @base-ui-components/react @floating-ui/react
pnpm add -D @types/react @types/react-dom
```
(Accept the current majors compatible with node 24 / Astro 5; note resolved versions in your report.)

- [ ] **Step 2: Add the React integration to `site/astro.config.mjs`**
```js
// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 3: `.gitignore` — add `.env`** (append a line `.env` to `site/.gitignore`).

- [ ] **Step 4: Create `site/.env.example`**
```bash
# Copy to .env and fill in. .env is gitignored.
# Public (exposed to the browser):
PUBLIC_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PUBLIC_EAS_SCHEMA_UID=
# Script-only (NEVER commit a real key; use a throwaway testnet key):
SEPOLIA_PRIVATE_KEY=
```

- [ ] **Step 5: Create `site/src/web3/types.ts`**
```ts
export const CONTRIBUTION_TYPES = [
  "Question",
  "Commentary",
  "Critique",
  "Localization note",
  "Clarification",
] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export interface Comment {
  uid: string; // EAS attestation UID (or a temporary id while pending)
  chapter: string;
  blockId: string;
  lang: string;
  contributionType: ContributionType;
  body: string;
  /** code-point offsets into the rendered block text */
  spanStart: number;
  spanEnd: number;
  spanExact: string;
  author: string; // wallet address
  pending: boolean; // optimistic until the tx confirms
}
```

- [ ] **Step 6: Create `site/src/web3/constants.ts`** (pure constants — Node-safe, no `import.meta.env`, so the registration script can import them) **and** `site/src/web3/config.ts` (browser wagmi config + env)

`site/src/web3/constants.ts`:
```ts
/** EAS deployments on Sepolia (verify against https://docs.attest.org/ deployments). */
export const EAS_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
export const SCHEMA_REGISTRY_ADDRESS = "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";
export const SEPOLIA_CHAIN_ID = 11155111;

/** The comment schema (registered once; demo keeps the body inline). */
export const SCHEMA =
  "string chapter,string blockId,string lang,bytes32 sourceId,bytes32 blockHash,uint32 spanStart,uint32 spanEnd,string spanExact,string spanPrefix,string spanSuffix,string contributionType,bytes32 parentUid,string body";
```

`site/src/web3/config.ts`:
```ts
import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export { SEPOLIA_CHAIN_ID } from "./constants";

const RPC_URL =
  import.meta.env.PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http(RPC_URL) },
});

export const SCHEMA_UID = import.meta.env.PUBLIC_EAS_SCHEMA_UID ?? "";
```

- [ ] **Step 7: Create a smoke island `site/src/components/comments/CommentApp.tsx`**
```tsx
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "../../web3/config";

const queryClient = new QueryClient();

interface Props {
  lang: string;
}

export default function CommentApp({ lang }: Props) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div data-comment-app data-lang={lang} hidden />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

- [ ] **Step 8: Mount it (smoke) in `site/src/components/Document.astro`** — add the import and place the island at the end of the root (just before the closing of the component). Add to the frontmatter `import CommentApp from "./comments/CommentApp";` and after the `<footer>…</footer>` add:
```astro
<CommentApp client:load lang={lang} />
```

- [ ] **Step 9: Update lint/fmt globs in `site/package.json`** so oxlint/oxfmt also cover `src/web3` + the `.tsx` files (they ignore `.astro` via config):
```json
    "lint": "oxlint src scripts tests",
    "fmt": "oxfmt 'src/**/*.ts' 'src/**/*.tsx' 'scripts/*.ts' 'tests/*.ts'",
    "fmt:check": "oxfmt --check 'src/**/*.ts' 'src/**/*.tsx' 'scripts/*.ts' 'tests/*.ts'",
```

- [ ] **Step 10: Build + gate**
- `pnpm run fmt` then `pnpm run lint` → exit 0.
- `pnpm run typecheck` → exit 0. `pnpm run check:astro` → 0 errors.
- `pnpm build` → 2 pages; `grep -rqs 'data-comment-app' dist/ && echo island-ok` → `island-ok` (the React island hydrated marker is emitted).
- `pnpm test` → still 65 pass.

- [ ] **Step 11: Commit**
```bash
git add site/package.json site/pnpm-lock.yaml site/astro.config.mjs site/.gitignore site/.env.example site/src/web3/constants.ts site/src/web3/config.ts site/src/web3/types.ts site/src/components/comments/CommentApp.tsx site/src/components/Document.astro
git commit -m "feat(site): web3 + react island scaffold (wagmi/sepolia/eas config)"
```

---

## Task 2: ethers v6 adapter (wagmi → signer)

**Files:** Create `site/src/web3/ethers.ts`.

This follows wagmi's official guide (https://wagmi.sh/react/guides/ethers). It can't be meaningfully unit-tested (needs a connected wallet); verify by typecheck + use in later tasks.

- [ ] **Step 1: Create `site/src/web3/ethers.ts`**
```ts
import { useMemo } from "react";
import { useConnectorClient } from "wagmi";
import type { Account, Chain, Client, Transport } from "viem";
import { BrowserProvider, JsonRpcSigner } from "ethers";

function clientToSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(transport, network);
  return new JsonRpcSigner(provider, account.address);
}

/** ethers v6 signer for the current wagmi connection (or undefined). */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useConnectorClient({ chainId });
  return useMemo(
    () => (client ? clientToSigner(client as Client<Transport, Chain, Account>) : undefined),
    [client],
  );
}
```

- [ ] **Step 2: Typecheck** — `pnpm run typecheck` → exit 0. (If the viem `Client` generics differ in the installed version, adjust the cast minimally; the shape is from the wagmi guide.)

- [ ] **Step 3: Commit**
```bash
git add site/src/web3/ethers.ts
git commit -m "feat(site): wagmi->ethers v6 signer adapter"
```

---

## Task 3: EAS schema encode/decode

**Files:** Create `site/src/web3/schema.ts`; Test `site/tests/schema.test.ts`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it, expect } from "vitest";
import { encodeComment, decodeComment, type CommentFields } from "../src/web3/schema";

const fields: CommentFields = {
  chapter: "02",
  blockId: "02-p7",
  lang: "ja",
  sourceId: "0x" + "11".repeat(32),
  blockHash: "0x" + "22".repeat(32),
  spanStart: 4,
  spanEnd: 12,
  spanExact: "walkaway",
  spanPrefix: "the ",
  spanSuffix: " test",
  contributionType: "Commentary",
  parentUid: "0x" + "00".repeat(32),
  body: "なるほど。",
};

describe("schema encode/decode", () => {
  it("round-trips all comment fields", () => {
    const decoded = decodeComment(encodeComment(fields));
    expect(decoded).toEqual(fields);
  });
  it("produces a 0x hex string", () => {
    expect(encodeComment(fields)).toMatch(/^0x[0-9a-f]+$/i);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm exec vitest run tests/schema.test.ts`.

- [ ] **Step 3: Implement `site/src/web3/schema.ts`**
```ts
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { SCHEMA } from "./constants";

export interface CommentFields {
  chapter: string;
  blockId: string;
  lang: string;
  sourceId: `0x${string}`;
  blockHash: `0x${string}`;
  spanStart: number;
  spanEnd: number;
  spanExact: string;
  spanPrefix: string;
  spanSuffix: string;
  contributionType: string;
  parentUid: `0x${string}`;
  body: string;
}

const encoder = () => new SchemaEncoder(SCHEMA);

export function encodeComment(f: CommentFields): string {
  return encoder().encodeData([
    { name: "chapter", value: f.chapter, type: "string" },
    { name: "blockId", value: f.blockId, type: "string" },
    { name: "lang", value: f.lang, type: "string" },
    { name: "sourceId", value: f.sourceId, type: "bytes32" },
    { name: "blockHash", value: f.blockHash, type: "bytes32" },
    { name: "spanStart", value: f.spanStart, type: "uint32" },
    { name: "spanEnd", value: f.spanEnd, type: "uint32" },
    { name: "spanExact", value: f.spanExact, type: "string" },
    { name: "spanPrefix", value: f.spanPrefix, type: "string" },
    { name: "spanSuffix", value: f.spanSuffix, type: "string" },
    { name: "contributionType", value: f.contributionType, type: "string" },
    { name: "parentUid", value: f.parentUid, type: "bytes32" },
    { name: "body", value: f.body, type: "string" },
  ]);
}

export function decodeComment(data: string): CommentFields {
  const items = encoder().decodeData(data);
  const get = (name: string) => items.find((i) => i.name === name)?.value.value;
  return {
    chapter: String(get("chapter")),
    blockId: String(get("blockId")),
    lang: String(get("lang")),
    sourceId: String(get("sourceId")) as `0x${string}`,
    blockHash: String(get("blockHash")) as `0x${string}`,
    spanStart: Number(get("spanStart")),
    spanEnd: Number(get("spanEnd")),
    spanExact: String(get("spanExact")),
    spanPrefix: String(get("spanPrefix")),
    spanSuffix: String(get("spanSuffix")),
    contributionType: String(get("contributionType")),
    parentUid: String(get("parentUid")) as `0x${string}`,
    body: String(get("body")),
  };
}
```
(If `decodeData`'s item shape differs in the installed SDK version — e.g. `i.value.value` is a `bigint` for uint32 — adapt the `Number(...)`/`String(...)` coercion so the round-trip test passes. That test is the contract.)

- [ ] **Step 4: Run, confirm PASS** — `pnpm exec vitest run tests/schema.test.ts` (2 tests).

- [ ] **Step 5: Commit**
```bash
git add site/src/web3/schema.ts site/tests/schema.test.ts
git commit -m "feat(site): EAS comment schema encode/decode"
```

---

## Task 4: Schema registration script

**Files:** Create `site/scripts/register-schema.ts`; add a `schema:register` script.

This is run **manually** by a human with a funded Sepolia key — not in CI.

- [ ] **Step 1: Create `site/scripts/register-schema.ts`**
```ts
import { JsonRpcProvider, Wallet } from "ethers";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { SCHEMA, SCHEMA_REGISTRY_ADDRESS } from "../src/web3/constants";

const pk = process.env.SEPOLIA_PRIVATE_KEY;
const rpc = process.env.PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
if (!pk) throw new Error("set SEPOLIA_PRIVATE_KEY (a funded Sepolia testnet key)");

const signer = new Wallet(pk, new JsonRpcProvider(rpc));
const registry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
registry.connect(signer);

console.log("registering schema on Sepolia…");
console.log(SCHEMA);
const tx = await registry.register({ schema: SCHEMA, resolverAddress: "0x".padEnd(42, "0"), revocable: true });
const uid = await tx.wait();
console.log(`\nschema UID: ${uid}`);
console.log("→ set PUBLIC_EAS_SCHEMA_UID in site/.env to this value");
```

- [ ] **Step 2: Add the script to `site/package.json`**
```json
    "schema:register": "tsx scripts/register-schema.ts",
```

- [ ] **Step 3: Typecheck + a no-network smoke** — `pnpm run typecheck` → exit 0. Run `pnpm run schema:register` WITHOUT a key and confirm it exits with the clear error `set SEPOLIA_PRIVATE_KEY …` (proves the guard; does not hit the network).

- [ ] **Step 4: Commit**
```bash
git add site/scripts/register-schema.ts site/package.json
git commit -m "feat(site): one-time EAS schema registration script (manual)"
```

---

## Task 5: Selection → anchor (browser)

**Files:** Create `site/src/web3/selection.ts`; Test `site/tests/selection.test.ts`. (Uses jsdom.)

- [ ] **Step 1: Write the failing test** `site/tests/selection.test.ts`
```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { normalizedBlockText, selectionToOffsets } from "../src/web3/selection";
import { normalizeBlockText } from "../src/lib/normalize";

function blockEl(text: string) {
  const el = document.createElement("div");
  el.textContent = text;
  return el;
}

describe("selection", () => {
  it("normalizes the block's textContent", () => {
    const el = blockEl("  Our role  ");
    expect(normalizedBlockText(el)).toBe(normalizeBlockText("  Our role  "));
  });

  it("maps a DOM range to code-point offsets in the normalized text", () => {
    // "the walkaway test" — select "walkaway" (chars 4..12)
    const el = blockEl("the walkaway test");
    const node = el.firstChild as Text;
    const range = document.createRange();
    range.setStart(node, 4);
    range.setEnd(node, 12);
    expect(selectionToOffsets(el, range)).toEqual({ start: 4, end: 12, exact: "walkaway" });
  });

  it("returns null when the range is collapsed or outside the block", () => {
    const el = blockEl("abc");
    const node = el.firstChild as Text;
    const collapsed = document.createRange();
    collapsed.setStart(node, 1);
    collapsed.setEnd(node, 1);
    expect(selectionToOffsets(el, collapsed)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm FAIL** — `pnpm exec vitest run tests/selection.test.ts`.

- [ ] **Step 3: Implement `site/src/web3/selection.ts`**
```ts
import { normalizeBlockText, codePointLength } from "../lib/normalize";
import { blockHash } from "../lib/hash";
import { makeAnchor, type Anchor } from "../lib/anchoring";

/** The normalized, rendered text of a block element (what the reader selects over). */
export function normalizedBlockText(blockEl: Element): string {
  return normalizeBlockText(blockEl.textContent ?? "");
}

export interface SelectionOffsets {
  start: number;
  end: number;
  exact: string;
}

/**
 * Map a DOM Range to code-point [start,end) offsets in the block's normalized text.
 * Returns null for collapsed ranges or ranges not fully inside the block.
 */
export function selectionToOffsets(blockEl: Element, range: Range): SelectionOffsets | null {
  if (range.collapsed) return null;
  if (!blockEl.contains(range.startContainer) || !blockEl.contains(range.endContainer)) return null;

  // Offset = normalized length of all text before the range boundary within the block.
  const before = range.cloneRange();
  before.selectNodeContents(blockEl);
  before.setEnd(range.startContainer, range.startOffset);
  const start = codePointLength(normalizeBlockText(before.toString()));

  const exactRaw = range.toString();
  const exact = normalizeBlockText(exactRaw);
  if (exact.length === 0) return null;
  const end = start + codePointLength(exact);
  return { start, end, exact };
}

/** Build a full M3 anchor for a selection within a block. */
export function anchorFromSelection(blockEl: Element, range: Range): Anchor | null {
  const offsets = selectionToOffsets(blockEl, range);
  if (offsets === null) return null;
  const text = normalizedBlockText(blockEl);
  return makeAnchor(blockHash(text), text, offsets.start, offsets.end);
}
```
(Note: mapping arbitrary rich selections through normalization is approximate; `normalizeBlockText` collapses whitespace, so the "before" length is computed on the normalized prefix. For the Mandate's plain prose this is exact; documented as a known limit for heavily-marked-up blocks.)

- [ ] **Step 4: Run, confirm PASS** — `pnpm exec vitest run tests/selection.test.ts` (3 tests).

- [ ] **Step 5: Commit**
```bash
git add site/src/web3/selection.ts site/tests/selection.test.ts
git commit -m "feat(site): DOM selection -> code-point offsets -> M3 anchor"
```

---

## Task 6: Connect button (wallet UI)

**Files:** Create `site/src/components/comments/ConnectButton.tsx`. **Integration task** — verify wagmi v2 hook names against the installed version; acceptance is build + check + manual.

- [ ] **Step 1: Implement `ConnectButton.tsx`** (wagmi v2 hooks: `useAccount`, `useConnect`, `useDisconnect`, `useSwitchChain`; the injected connector; guard to Sepolia)
```tsx
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { SEPOLIA_CHAIN_ID } from "../../web3/config";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const cls = "rounded border border-stone-300 px-2 py-1 text-sm hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800";

  if (!isConnected) {
    return (
      <button className={cls} disabled={isPending} onClick={() => connect({ connector: injected() })}>
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }
  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <button className={cls} onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}>
        Switch to Sepolia
      </button>
    );
  }
  return (
    <button className={cls} title="Disconnect" onClick={() => disconnect()}>
      {address ? short(address) : "Connected"}
    </button>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm run typecheck` (exit 0), `pnpm run check:astro` (0). (Manual wallet behavior is checked in Task 9.)

- [ ] **Step 3: Commit**
```bash
git add site/src/components/comments/ConnectButton.tsx
git commit -m "feat(site): wallet connect button (injected, sepolia guard)"
```

---

## Task 7: Selection popover + composer + attest

**Files:** Create `site/src/components/comments/SelectionPopover.tsx`, `site/src/components/comments/Composer.tsx`, `site/src/web3/eas.ts`. **Integration task** — verify Base UI (`@base-ui-components/react`) Dialog API and EAS SDK `attest` shape against installed versions; acceptance is build + check + manual.

- [ ] **Step 1: `site/src/web3/eas.ts`** (thin attest wrapper)
```ts
import { EAS } from "@ethereum-attestation-service/eas-sdk";
import type { Signer } from "ethers";
import { EAS_ADDRESS } from "./constants";

const ZERO_ADDR = "0x".padEnd(42, "0");

/** Submit a comment attestation; resolves to the new attestation UID. */
export async function attestComment(
  signer: Signer,
  schemaUid: string,
  encodedData: string,
): Promise<string> {
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(signer);
  const tx = await eas.attest({
    schema: schemaUid,
    data: { recipient: ZERO_ADDR, expirationTime: 0n, revocable: true, data: encodedData },
  });
  return await tx.wait(); // the new attestation UID
}
```

- [ ] **Step 2: `Composer.tsx`** — a Base UI `Dialog` with a `contributionType` select + `body` textarea. On submit it calls a passed `onSubmit(type, body)` and shows pending/error state. Use `@base-ui-components/react`'s Dialog primitive (verify import path + parts: `Dialog.Root/Portal/Backdrop/Popup/Title/Close` in the installed version). Keep it Tailwind-styled, dark-mode aware. Props: `{ open, onOpenChange, onSubmit, pending, error }`. The `contributionType` options come from `CONTRIBUTION_TYPES` (web3/types).

- [ ] **Step 3: `SelectionPopover.tsx`** — given an anchor rect (from `range.getBoundingClientRect()`), render a small floating "💬 Comment" button positioned with `@floating-ui/react` (or absolute positioning from the rect). Props: `{ rect, onClick }`.

- [ ] **Step 4: Verify** — `pnpm run typecheck` (exit 0), `pnpm run check:astro` (0), `pnpm build` (2 pages). (Behavior verified manually in Task 9.)

- [ ] **Step 5: Commit**
```bash
git add site/src/web3/eas.ts "site/src/components/comments/Composer.tsx" "site/src/components/comments/SelectionPopover.tsx"
git commit -m "feat(site): composer dialog + selection popover + EAS attest wrapper"
```

---

## Task 8: Wire it together (CommentApp island + portals)

**Files:** Modify `site/src/components/comments/CommentApp.tsx`, `site/src/components/Toolbar.astro`, `site/src/components/Document.astro`; Create `site/src/components/comments/CommentMarker.tsx`. **Integration task** — build + check + manual.

- [ ] **Step 1: Toolbar wallet slot** — in `Toolbar.astro`, add an empty `<span id="wallet-slot"></span>` inside the right-hand controls `<div class="flex items-center gap-3 text-sm">` (the React app portals the connect button into it).

- [ ] **Step 2: `CommentApp.tsx`** — the controller island. Responsibilities (provide real code):
  - Wrap in `WagmiProvider` + `QueryClientProvider` (already scaffolded).
  - `createPortal(<ConnectButton/>, document.getElementById("wallet-slot"))`.
  - On mount, attach a `selectionchange`/`mouseup` listener; when a non-collapsed selection is inside a `[data-block-id]` element, compute the block element + `Range`, build the anchor via `anchorFromSelection`, and show `<SelectionPopover>` at the range rect.
  - Clicking the popover opens `<Composer>`. On submit: read `lang` (prop) + `chapter`/`blockId` from the block element's `data-block-id` (`NN-pM` → chapter = first two chars), `sourceId` via M1 `sourceIdHash` of a per-lang identifier const, build `CommentFields` (anchor offsets/exact/prefix/suffix + blockHash, `parentUid` = `0x00…`), `encodeComment`, get the signer via `useEthersSigner`, `attestComment(...)`, then push an optimistic `Comment` (pending) into local state and render a `<CommentMarker>` in that block's `.gutter`. Mark `pending:false` once `tx.wait()` resolves.
  - Gate everything on `document.documentElement.dataset.comments === "on"` (and react to changes) so the layer only acts when commentary is on.
- [ ] **Step 3: `CommentMarker.tsx`** — a minimal optimistic gutter badge (e.g. `💬` with a count / a pending spinner) portalled into a block's `.gutter`; clicking shows the just-authored comment (type + body + author + a "Comment for past version"/pending tag). (Full thread rendering + reading existing comments is M5.)
- [ ] **Step 4: Mount** — ensure `Document.astro` renders `<CommentApp client:load lang={lang} />` (from Task 1) once.
- [ ] **Step 5: Verify** — `pnpm run lint` (0), `pnpm run typecheck` (0), `pnpm run check:astro` (0), `pnpm build` (2 pages, `data-comment-app` present), `pnpm test` (still green). 
- [ ] **Step 6: Commit**
```bash
git add site/src/components/comments site/src/components/Toolbar.astro site/src/components/Document.astro
git commit -m "feat(site): comment authoring layer (select -> compose -> attest -> optimistic)"
```

---

## Task 9: Docs, CI, manual demo checklist, final verify

**Files:** Modify `site/README.md`, `.github/workflows/site-checks.yml`.

- [ ] **Step 1: README "Commenting (M4)" section** — append: the env vars (`PUBLIC_SEPOLIA_RPC_URL`, `PUBLIC_EAS_SCHEMA_UID`, `SEPOLIA_PRIVATE_KEY`); the one-time setup (wallet + faucet → `pnpm run schema:register` → set `PUBLIC_EAS_SCHEMA_UID`); that comments are EAS attestations on Sepolia authored over the rendered selection; that reading-back/threads land in M5.

- [ ] **Step 2: CI** — confirm `.github/workflows/site-checks.yml` still runs `lint`, `fmt:check`, `typecheck`, `check:astro`, `test`, `blocks:check`, `anchors:build`, `build`. No on-chain step (it needs a wallet). Add a comment in the YAML noting the chain e2e is manual. (No new failing steps.)

- [ ] **Step 3: Full local gate** — from `site/`: `pnpm run lint` (0) · `pnpm run fmt:check` (0) · `pnpm run typecheck` (0) · `pnpm run check:astro` (0) · `pnpm test` (schema + selection added → report counts) · `pnpm build` (2 pages).

- [ ] **Step 4: Manual demo checklist** (record in the commit message / report; requires a human + funded Sepolia wallet):
  1. `cp .env.example .env`, set `PUBLIC_SEPOLIA_RPC_URL` + (after registering) `PUBLIC_EAS_SCHEMA_UID`.
  2. `pnpm run schema:register` with a funded `SEPOLIA_PRIVATE_KEY` → UID set in `.env`.
  3. `pnpm dev`; toggle comments **on**; connect wallet; switch to Sepolia; select text in a chapter; click 💬; choose a type, write a body; submit; approve the tx in the wallet; see the optimistic badge → confirmed; verify the attestation on easscan.org (Sepolia).

- [ ] **Step 5: Commit**
```bash
git add site/README.md .github/workflows/site-checks.yml
git commit -m "docs(site): M4 commenting setup + manual demo checklist"
```

---

## Self-Review notes (for the planner)

- **Spec coverage (M4 = §16 wallet + EAS write):** wagmi/Sepolia/injected (Tasks 1, 6); ethers adapter → EAS SDK (Tasks 2, 7); schema + encode (Tasks 1, 3) + registration (Task 4); span-select → compose → attest → optimistic (Tasks 5, 7, 8); contribution-type taxonomy reused (Task 1 types). Base UI + Floating UI for overlays (Task 7) per §13.
- **Anchor basis** matches the decision: browser-side over rendered selection, reusing M1 `normalize`/`hash` + M3 `makeAnchor` (Task 5) — no duplication.
- **Deferred to M5 (read side):** querying EAS (GraphQL) for existing attestations, the projection (`project`) onto the current page, gutter aggregation/threads, the `needs-review`/`orphaned` panels, the "Comment for past version" rendering at scale. M4 only renders the just-authored comment optimistically.
- **Deferred to production:** off-chain attestations + Merkle timestamp / mainnet (§17); IPFS bodies; WalletConnect/mobile; gasless. Schema trimmed for the demo (no `sourceCommit`/`bodyHash`/`schemaVersion`) — noted.
- **Testing honesty:** Tasks 3 and 5 are unit-tested (round-trip, jsdom offsets); Tasks 2, 6, 7, 8 are build/typecheck/check + manual demo (no funded wallet in CI). This is called out up top and per task.
- **Type consistency:** `CommentFields` (schema.ts) ↔ the encode/decode list ↔ the SCHEMA string order; `Anchor` from M3 reused; `ContributionType`/`Comment` (types.ts) shared by the UI.
