import { describe, it, expect } from "vitest";
import { decodeAnno, type AnnoFields } from "../src/anno/schema";
import { encodeAnno } from "../src/anno/encode";
import { ANNO_SCHEMA } from "../src/anno/constants";

const fields: AnnoFields = {
  url: "https://example.com/post?id=42",
  urlCanonical: "https://example.com/post?id=42",
  origin: "https://example.com",
  lang: "en",
  rootSelector: '[id="main"] > p:nth-of-type(3)',
  containerHash: `0x${"22".repeat(32)}`,
  spanStart: 4,
  spanEnd: 12,
  spanExact: "walkaway",
  spanPrefix: "the ",
  spanSuffix: " test",
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
  it("ANNO_SCHEMA is byte-identical to the registered schema string (UID depends on it)", () => {
    expect(ANNO_SCHEMA).toBe(
      "string url,string urlCanonical,string origin,string lang,string rootSelector,bytes32 containerHash,uint32 spanStart,uint32 spanEnd,string spanExact,string spanPrefix,string spanSuffix,string body,string meta",
    );
  });
});
