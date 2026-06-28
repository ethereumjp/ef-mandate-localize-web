// Generates src/anno/mock-comments.json — a captured EAS GraphQL response: an
// array of raw attestations `{ id, attester, time, revoked, data }` where `data`
// is `encodeAnno`-encoded. The dev mock loads + decodes these EXACTLY like
// `fetchAnno` does. Edit the SOURCE below and re-run `pnpm gen:mock`.
//
// `urlCanonical` is stored path-relative ("/", "/ja"); the mock loader rebinds it
// to the running origin so the fixture works on any dev port.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeAnchor, codePoints, type Anchor } from "@anno/core/lib/anchoring";
import { blockHash } from "@anno/core/lib/hash";
import { normalizeBlockText } from "@anno/core/lib/normalize";
import type { AnnoFields } from "@anno/core/anno/schema";
import { annoFieldDefs } from "@anno/core/anno/encode-defs";
import { ANNO_SCHEMA } from "@anno/core/anno/constants";
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
const ZERO_UID = "0x" + "00".repeat(32);
/** A bytes32 mock attestation id from a small seed byte. */
const id = (seed: number) => "0x" + seed.toString(16).padStart(2, "0").repeat(32);

// Captured block textContent (post-render, pre-normalization). Re-capture + re-run
// if the essay content changes. The `closing` block is the Dante line in ch. VIII,
// which is Italian in both languages (the ja chapter is untranslated → the page
// renders the en/Italian text as a muted fallback, so the same quote anchors).
const BLOCKS: Record<"en" | "ja", Record<"dream" | "role" | "closing", string>> = {
  en: {
    dream: "Ethereum was born out of a dream. A dream for freedom.",
    role: "The Foundation is not the parent, owner, or ruler of Ethereum. We are not “the system” itself.",
    closing: "E quindi uscimmo a riveder le stelle.",
  },
  ja: {
    dream: "イーサリアムは、ある夢から生まれた。それは「自由」への夢である。",
    role: "EFは、イーサリアムの親組織でも、所有者でも、支配者でもない。EFは「システム」そのものではない。",
    closing: "E quindi uscimmo a riveder le stelle.",
  },
};

// One comment per block. `quote` must be a verbatim substring of the rendered
// (normalized) block text — it's the anchored span the card shows.
const COMMENTS: Record<
  "en" | "ja",
  { block: "dream" | "role" | "closing"; quote: string; body: string }[]
> = {
  en: [
    { block: "dream", quote: "Ethereum was born out of a dream.", body: "Great!" },
    {
      block: "role",
      quote:
        "The Foundation is not the parent, owner, or ruler of Ethereum. We are not “the system” itself.",
      body: "👍",
    },
    { block: "closing", quote: "E quindi uscimmo a riveder le stelle.", body: "I like this closing." },
  ],
  ja: [
    { block: "dream", quote: "イーサリアムは、ある夢から生まれた。", body: "素晴らしい！" },
    {
      block: "role",
      quote:
        "EFは、イーサリアムの親組織でも、所有者でも、支配者でもない。EFは「システム」そのものではない。",
      body: "👍",
    },
    { block: "closing", quote: "E quindi uscimmo a riveder le stelle.", body: "この結びが好き。" },
  ],
};

interface Raw {
  id: string;
  attester: string;
  time: number;
  revoked: boolean;
  refUID: string;
  data: string;
}

/** Find the code-point index of `quote` within `normCps`, or -1. */
function cpIndexOf(normCps: string[], quoteCps: string[]): number {
  outer: for (let i = 0; i + quoteCps.length <= normCps.length; i++) {
    for (let j = 0; j < quoteCps.length; j++) {
      if (normCps[i + j] !== quoteCps[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Anchor the verbatim `quote` within normalized block text (status: anchored). */
function anchorQuote(norm: string, hash: `0x${string}`, quote: string): Anchor {
  const idx = cpIndexOf(codePoints(norm), codePoints(quote));
  if (idx < 0) throw new Error(`quote not found in block text: ${JSON.stringify(quote)}`);
  return makeAnchor(hash, norm, idx, idx + codePoints(quote).length);
}

function fields(o: { lang: "en" | "ja"; path: string; body: string; anchor: Anchor }): AnnoFields {
  const a = o.anchor;
  return {
    url: o.path,
    urlCanonical: o.path,
    origin: o.path,
    lang: o.lang,
    rootSelector: "", // block-ID-free: anchor by quote (display findByQuote fallback)
    containerHash: a.blockHash,
    spanStart: a.start,
    spanEnd: a.end,
    spanExact: a.exact,
    spanPrefix: a.prefix,
    spanSuffix: a.suffix,
    body: o.body,
    meta: "",
  };
}

const raws: Raw[] = [];
const add = (uid: string, f: AnnoFields) =>
  raws.push({ id: uid, attester: AUTHOR, time: TIME, revoked: false, refUID: ZERO_UID, data: encodeAnno(f) });

for (const lang of ["en", "ja"] as const) {
  const path = lang === "ja" ? "/ja" : "/";
  const k = lang === "ja" ? 0xd0 : 0xa0;
  COMMENTS[lang].forEach((c, i) => {
    const norm = normalizeBlockText(BLOCKS[lang][c.block]);
    add(id(k + 1 + i), fields({ lang, path, body: c.body, anchor: anchorQuote(norm, blockHash(norm), c.quote) }));
  });
}

// The fixture lives in core (the loader is @anno/core/anno/mock); write there.
const outPath = fileURLToPath(new URL("../../core/src/anno/mock-comments.json", import.meta.url));
writeFileSync(outPath, JSON.stringify(raws, null, 2) + "\n");
console.log(`wrote ${raws.length} mock attestations → ${outPath}`);
