// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { projectComments } from "../src/web3/projectComments";
import { normalizedBlockText } from "../src/web3/selection";
import { blockHash } from "../src/lib/hash";
import type { StoredComment } from "../src/web3/read";

function stored(over: Partial<StoredComment>): StoredComment {
  return {
    uid: "0x1",
    attester: "0xa",
    time: 0,
    chapter: "02",
    blockId: "02-p7",
    lang: "ja",
    blockHash: "0x" + "00".repeat(32),
    spanStart: 4,
    spanEnd: 12,
    spanExact: "walkaway",
    spanPrefix: "the ",
    spanSuffix: " test",
    parentUid: "0x" + "00".repeat(32),
    body: "x",
    ...over,
  };
}

describe("projectComments", () => {
  it("marks a comment whose blockHash matches the live text as anchored", () => {
    const el = document.createElement("div");
    el.textContent = "the walkaway test";
    const liveHash = blockHash(normalizedBlockText(el));
    const out = projectComments(el, [stored({ blockHash: liveHash })]);
    expect(out[0].projection.status).toBe("anchored");
    expect(out[0].projection.start).toBe(4);
  });

  it("re-anchors when the block changed but the quote still exists", () => {
    const el = document.createElement("div");
    el.textContent = "see the walkaway test now"; // different text/hash, quote present
    const out = projectComments(el, [stored({ blockHash: "0x" + "ab".repeat(32) })]);
    expect(out[0].projection.status).toBe("re-anchored");
    expect(out[0].projection.pastVersion).toBe(true);
  });
});
