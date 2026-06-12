import { describe, it, expect } from "vitest";
import { buildChapterAnchors } from "../src/lib/anchors";
import { blockHashFromNormalized } from "@commentary/core/lib/hash";

describe("buildChapterAnchors", () => {
  it("keys entries by blockId with order, text and hash", () => {
    const src = "<!-- block: 02-p1 -->\nHello\n\n<!-- block: 02-p2 -->\nWorld";
    const anchors = buildChapterAnchors(src);
    expect(Object.keys(anchors)).toEqual(["02-p1", "02-p2"]);
    expect(anchors["02-p1"]).toEqual({
      blockId: "02-p1",
      order: 0,
      text: "Hello",
      blockHash: blockHashFromNormalized("Hello"),
    });
    expect(anchors["02-p2"].order).toBe(1);
  });
  it("throws if a block has no id", () => {
    expect(() => buildChapterAnchors("no marker")).toThrow(/no id/);
  });
});
