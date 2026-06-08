import { describe, it, expect } from "vitest";
import { buildThreads } from "../src/web3/thread";
import type { StoredComment } from "../src/web3/read";

const ZERO = "0x" + "00".repeat(32);
function c(uid: string, parentUid: string, body: string): StoredComment {
  return {
    uid,
    parentUid,
    body,
    attester: "0xa",
    time: 0,
    chapter: "02",
    blockId: "02-p7",
    lang: "ja",
    blockHash: "0x" + "22".repeat(32),
    spanStart: 0,
    spanEnd: 1,
    spanExact: "x",
    spanPrefix: "",
    spanSuffix: "",
  };
}

describe("buildThreads", () => {
  it("nests replies under their parent; top-level = zero parentUid", () => {
    const tree = buildThreads([
      c("0x1", ZERO, "root"),
      c("0x2", "0x1", "reply"),
      c("0x3", ZERO, "root2"),
    ]);
    expect(tree.map((n) => n.comment.uid)).toEqual(["0x1", "0x3"]);
    expect(tree[0].replies.map((n) => n.comment.uid)).toEqual(["0x2"]);
  });

  it("treats a reply to an unknown parent as top-level", () => {
    const tree = buildThreads([c("0x2", "0xUNKNOWN", "orphanReply")]);
    expect(tree.map((n) => n.comment.uid)).toEqual(["0x2"]);
  });
});
