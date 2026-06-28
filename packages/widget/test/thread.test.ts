import { describe, it, expect } from "vitest";
import { buildThreads } from "../src/web3/thread";

const ZERO = "0x" + "00".repeat(32);
function c(uid: string, parentUid: string) {
  return { uid, parentUid };
}

describe("buildThreads", () => {
  it("nests replies under their parent; top-level = zero parentUid", () => {
    const tree = buildThreads([c("0x1", ZERO), c("0x2", "0x1"), c("0x3", ZERO)]);
    expect(tree.map((n) => n.comment.uid)).toEqual(["0x1", "0x3"]);
    expect(tree[0].replies.map((n) => n.comment.uid)).toEqual(["0x2"]);
  });

  it("treats a reply to an unknown parent as top-level", () => {
    const tree = buildThreads([c("0x2", "0xUNKNOWN")]);
    expect(tree.map((n) => n.comment.uid)).toEqual(["0x2"]);
  });
});
