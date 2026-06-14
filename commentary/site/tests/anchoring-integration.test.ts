import { describe, it, expect } from "vitest";
import { makeAnchor, project } from "@commentary/core/lib/anchoring";
import { normalizeBlockText } from "@commentary/core/lib/normalize";
import { blockHashFromNormalized } from "@commentary/core/lib/hash";

/** A live block's {text, blockHash} from plain paragraph text (no markers). */
function blockOf(text: string) {
  const norm = normalizeBlockText(text);
  return { text: norm, blockHash: blockHashFromNormalized(norm) };
}

const ORIGINAL = "Our ultimate goal is for Ethereum to pass the walkaway test.";

describe("anchoring integration", () => {
  const orig = blockOf(ORIGINAL);
  const quoteStart = [...orig.text.slice(0, orig.text.indexOf("walkaway"))].length;
  const anchor = makeAnchor(orig.blockHash, orig.text, quoteStart, quoteStart + "walkaway".length);

  it("anchored: the commented block is unchanged", () => {
    const p = project(anchor, blockOf(ORIGINAL));
    expect(p.status).toBe("anchored");
    expect(p.pastVersion).toBe(false);
  });

  it("re-anchored: the block changed but the quote survives", () => {
    const cur = blockOf("Ultimately, Ethereum must pass the walkaway test someday.");
    const p = project(anchor, cur);
    expect(p.status).toBe("re-anchored");
    expect(p.pastVersion).toBe(true);
    expect(cur.text.slice(p.start!, p.end!)).toBe("walkaway");
  });

  it("needs-review: the quoted word was rewritten", () => {
    const p = project(anchor, blockOf("Our ultimate goal is for Ethereum to pass the leave test."));
    expect(p.status).toBe("needs-review");
    expect(p.pastVersion).toBe(true);
  });

  it("orphaned: the commented block was removed", () => {
    const p = project(anchor, null);
    expect(p.status).toBe("orphaned");
    expect(p.pastVersion).toBe(true);
  });
});
