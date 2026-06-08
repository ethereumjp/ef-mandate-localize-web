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
