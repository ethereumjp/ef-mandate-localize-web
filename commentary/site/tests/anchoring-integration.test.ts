import { describe, it, expect } from "vitest";
import { buildChapterAnchors } from "../src/lib/anchors";
import { makeAnchor, project } from "@commentary/core/lib/anchoring";

const ORIGINAL =
  "<!-- block: 02-p1 -->\n# II. Our Role\n\n" +
  "<!-- block: 02-p2 -->\nOur ultimate goal is for Ethereum to pass the walkaway test.";

function blockOf(source: string, id: string) {
  const a = buildChapterAnchors(source);
  return a[id] ?? null;
}

describe("anchoring integration", () => {
  const orig = buildChapterAnchors(ORIGINAL)["02-p2"];
  const quoteStart = orig.text.indexOf("walkaway");
  const start = [...orig.text.slice(0, quoteStart)].length;
  const end = start + "walkaway".length;
  const anchor = makeAnchor(orig.blockHash, orig.text, start, end); // quote: "walkaway"

  it("anchored: the commented block is unchanged (another block edited)", () => {
    const edited =
      "<!-- block: 02-p1 -->\n# II. Our Role (revised)\n\n" +
      "<!-- block: 02-p2 -->\nOur ultimate goal is for Ethereum to pass the walkaway test.";
    const p = project(anchor, blockOf(edited, "02-p2"));
    expect(p.status).toBe("anchored");
    expect(p.pastVersion).toBe(false);
  });

  it("re-anchored: the commented block changed but the quote survives", () => {
    const edited =
      "<!-- block: 02-p1 -->\n# II. Our Role\n\n" +
      "<!-- block: 02-p2 -->\nUltimately, Ethereum must pass the walkaway test someday.";
    const cur = blockOf(edited, "02-p2");
    const p = project(anchor, cur);
    expect(p.status).toBe("re-anchored");
    expect(p.pastVersion).toBe(true);
    expect(cur!.text.slice(p.start!, p.end!)).toBe("walkaway");
  });

  it("needs-review: the quoted word was rewritten", () => {
    const edited =
      "<!-- block: 02-p1 -->\n# II. Our Role\n\n" +
      "<!-- block: 02-p2 -->\nOur ultimate goal is for Ethereum to pass the leave test.";
    const p = project(anchor, blockOf(edited, "02-p2"));
    expect(p.status).toBe("needs-review");
    expect(p.pastVersion).toBe(true);
  });

  it("orphaned: the commented block was removed", () => {
    const edited = "<!-- block: 02-p1 -->\n# II. Our Role";
    const p = project(anchor, blockOf(edited, "02-p2"));
    expect(p.status).toBe("orphaned");
    expect(p.pastVersion).toBe(true);
  });
});
