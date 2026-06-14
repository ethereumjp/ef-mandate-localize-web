// Generates src/anno/mock-comments.json — a captured EAS GraphQL response: an
// array of raw attestations `{ id, attester, time, revoked, data }` where `data`
// is `encodeAnno`-encoded. The dev mock loads + decodes these EXACTLY like
// `fetchAnno` does. Edit the SOURCE below and re-run `pnpm gen:mock`.
//
// `urlCanonical` is stored path-relative ("/", "/ja"); the mock loader rebinds it
// to the running origin so the fixture works on any dev port.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeAnchor, codePoints, type Anchor } from "@commentary/core/lib/anchoring";
import { blockHash } from "@commentary/core/lib/hash";
import { normalizeBlockText } from "@commentary/core/lib/normalize";
import type { AnnoFields } from "@commentary/core/anno/schema";
import { annoFieldDefs } from "@commentary/core/anno/encode-defs";
import { ANNO_SCHEMA } from "@commentary/core/anno/constants";
// Node-side EAS encoder: the SDK's named export isn't available under Node 24
// strict ESM, so use the default (CJS-interop) import here. anno/schema.ts uses
// the named import (for Vite/vitest); both share annoFieldDefs (encode-defs).
import type { SchemaEncoder as SchemaEncoderType } from "@ethereum-attestation-service/eas-sdk";
import easSdk from "@ethereum-attestation-service/eas-sdk";
const { SchemaEncoder } = easSdk as unknown as { SchemaEncoder: typeof SchemaEncoderType };
const enc = new SchemaEncoder(ANNO_SCHEMA);
const encodeAnno = (f: AnnoFields) => enc.encodeData(annoFieldDefs(f));

const AUTHOR = "0x1234567890abcdef1234567890abcdef12345678";
const TIME = 1717000000; // fixed → shown as 2024/5/30 in the card
const STALE = ("0x" + "ee".repeat(32)) as `0x${string}`; // mismatched hash → re-anchored
const ZERO_UID = "0x" + "00".repeat(32);
/** A bytes32 mock attestation id from a small seed byte. */
const id = (seed: number) => "0x" + seed.toString(16).padStart(2, "0").repeat(32);

// Captured block textContent (pre-normalization). Re-capture + re-run if the
// essay content changes. Block ids are shared across languages; text differs.
const BLOCKS: Record<"en" | "ja", Record<string, string>> = {
  en: {
    "01-p2": " Ethereum was born out of a dream. A dream for freedom. ",
    "01-p3":
      " Not just for one, not just for many, but for all who are ready to grasp it with their own hands. ",
  },
  ja: {
    "01-p2": " イーサリアムは、ある夢から生まれた。それは「自由」への夢である。 ",
    "01-p3":
      " それは、たった一人や、一部の人のためではなく、自らの手でそれを掴む覚悟のあるすべての人々のためのものだ。 ",
  },
};

const BODIES = {
  en: {
    a1: "Strong opening. Is “mandate” the EF’s remit specifically, or Ethereum’s?",
    a1r: "The Foundation’s remit — see ch. III “Our Mandate”.",
    a2: "Translation note: rendering “mandate” as a duty vs. an authority is still open.",
    b1: "Re-anchored: the source changed since this was written, quote relocated.",
    c1: "The text I quoted is gone — flagged for review.",
  },
  ja: {
    a1: "力強い書き出し。「mandate(使命)」は EF 固有の話か、イーサリアム全体のことか?",
    a1r: "財団の使命のこと — 第 III 章「我々の使命」を参照。",
    a2: "訳語メモ:「mandate」を「使命」と訳すか「権限」とするか検討中。",
    b1: "再アンカリング:執筆後に原文が変わり、引用位置を再特定した。",
    c1: "引用していた箇所が消えている — 要確認としてフラグ。",
  },
};

interface Raw {
  id: string;
  attester: string;
  time: number;
  revoked: boolean;
  data: string;
}

/** Anchor [from, from+span) of normalized block text, clamped to fit. */
function anchorOf(norm: string, hash: `0x${string}`, from: number, span: number): Anchor {
  const len = codePoints(norm).length;
  const start = Math.max(0, Math.min(from, len - 1));
  const end = Math.min(start + span, len);
  return makeAnchor(hash, norm, start, end);
}

function fields(o: {
  lang: "en" | "ja";
  path: string;
  blockId: string;
  body: string;
  parentUid?: string;
  anchor?: Anchor;
  orphanQuote?: string;
}): AnnoFields {
  const a = o.anchor;
  return {
    url: o.path,
    urlCanonical: o.path,
    origin: o.path,
    lang: o.lang,
    rootSelector: "", // block-ID-free: anchor by quote (display findByQuote fallback)
    containerHash: a ? a.blockHash : STALE,
    spanStart: a ? a.start : 0,
    spanEnd: a ? a.end : 0,
    spanExact: a ? a.exact : (o.orphanQuote ?? ""),
    spanPrefix: a ? a.prefix : "",
    spanSuffix: a ? a.suffix : "",
    parentUid: o.parentUid ?? ZERO_UID,
    body: o.body,
    meta: "",
  };
}

const raws: Raw[] = [];
const add = (uid: string, f: AnnoFields) =>
  raws.push({ id: uid, attester: AUTHOR, time: TIME, revoked: false, data: encodeAnno(f) });

for (const lang of ["en", "ja"] as const) {
  const path = lang === "ja" ? "/ja" : "/";
  const p2 = normalizeBlockText(BLOCKS[lang]["01-p2"]);
  const p3 = normalizeBlockText(BLOCKS[lang]["01-p3"]);
  const B = BODIES[lang];
  const k = lang === "ja" ? 0xd0 : 0xa0;
  const A1 = id(k + 1);

  // anchored thread on 01-p2 (comment + reply on the same span)
  add(
    A1,
    fields({
      lang,
      path,
      blockId: "01-p2",
      body: B.a1,
      anchor: anchorOf(p2, blockHash(p2), 0, 16),
    }),
  );
  add(
    id(k + 2),
    fields({
      lang,
      path,
      blockId: "01-p2",
      body: B.a1r,
      parentUid: A1,
      anchor: anchorOf(p2, blockHash(p2), 0, 16),
    }),
  );
  // a second anchored comment, different span
  add(
    id(k + 3),
    fields({
      lang,
      path,
      blockId: "01-p2",
      body: B.a2,
      anchor: anchorOf(p2, blockHash(p2), 18, 14),
    }),
  );
  // re-anchored: real quote from 01-p3 but a stale containerHash
  add(
    id(k + 4),
    fields({ lang, path, blockId: "01-p3", body: B.b1, anchor: anchorOf(p3, STALE, 0, 14) }),
  );
  // needs-review: a quote that no longer exists in 01-p4
  add(
    id(k + 5),
    fields({
      lang,
      path,
      blockId: "01-p4",
      body: B.c1,
      orphanQuote: "⟪a phrase that no longer exists⟫",
    }),
  );
}

// The fixture lives in core (the loader is @commentary/core/anno/mock); write there.
const outPath = fileURLToPath(new URL("../../core/src/anno/mock-comments.json", import.meta.url));
writeFileSync(outPath, JSON.stringify(raws, null, 2) + "\n");
console.log(`wrote ${raws.length} mock attestations → ${outPath}`);
