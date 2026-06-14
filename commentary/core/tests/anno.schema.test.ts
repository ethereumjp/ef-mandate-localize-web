import { describe, it, expect } from "vitest";
import { decodeAnno, type AnnoFields } from "../src/anno/schema";
import { encodeAnno } from "../src/anno/encode";

const fields: AnnoFields = {
  url: "https://example.com/post?id=42",
  urlCanonical: "https://example.com/post?id=42",
  origin: "https://example.com",
  lang: "en",
  rootSelector: '[id="main"] > p:nth-of-type(3)',
  containerHash: "0x" + "22".repeat(32),
  spanStart: 4,
  spanEnd: 12,
  spanExact: "walkaway",
  spanPrefix: "the ",
  spanSuffix: " test",
  parentUid: "0x" + "00".repeat(32),
  body: "なるほど。",
  meta: "",
};

describe("anno schema encode/decode", () => {
  it("round-trips all fields", () => {
    expect(decodeAnno(encodeAnno(fields))).toEqual(fields);
  });
  it("round-trips a non-empty meta JSON string", () => {
    const withMeta = { ...fields, meta: JSON.stringify({ motivation: "questioning" }) };
    expect(decodeAnno(encodeAnno(withMeta))).toEqual(withMeta);
  });
  it("produces a 0x hex string", () => {
    expect(encodeAnno(fields)).toMatch(/^0x[0-9a-f]+$/i);
  });
});
