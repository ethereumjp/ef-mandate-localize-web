// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { locate, orphanAnno, type StoredAnno } from "../src/anno/locate";
import { normalizedBlockText } from "../src/lib/anchor-dom";
import { blockHashFromNormalized } from "../src/lib/hash";

function stored(over: Partial<StoredAnno>): StoredAnno {
  return {
    uid: "0x1",
    attester: "0xa",
    time: 0,
    refUID: "0x" + "00".repeat(32),
    url: "https://example.com/x",
    urlCanonical: "https://example.com/x",
    origin: "https://example.com",
    lang: "en",
    rootSelector: '[id="b1"]',
    containerHash: `0x${"00".repeat(32)}`,
    spanStart: 4,
    spanEnd: 12,
    spanExact: "walkaway",
    spanPrefix: "the ",
    spanSuffix: " test",
    body: "x",
    meta: "",
    ...over,
  };
}

describe("locate", () => {
  it("marks a comment anchored when the container hash matches the live text", () => {
    document.body.innerHTML = '<p id="b1">the walkaway test</p>';
    const text = normalizedBlockText(document.querySelector("p")!);
    const out = locate(document, stored({ containerHash: blockHashFromNormalized(text) }));
    expect(out.projection.status).toBe("anchored");
    expect(out.projection.start).toBe(4);
  });

  it("re-anchors when the container changed but the quote still exists", () => {
    document.body.innerHTML = '<p id="b1">see the walkaway test now</p>';
    const out = locate(document, stored({ containerHash: `0x${"ab".repeat(32)}` }));
    expect(out.projection.status).toBe("re-anchored");
    expect(out.projection.pastVersion).toBe(true);
  });

  it("re-anchors via the fallback when the selector is stale but the quote exists elsewhere", () => {
    document.body.innerHTML = "<article><p>intro</p><p>the walkaway test</p></article>";
    const out = locate(
      document,
      stored({ rootSelector: '[id="gone"]', containerHash: `0x${"ab".repeat(32)}` }),
    );
    expect(out.projection.status).toBe("re-anchored");
    expect(out.projection.pastVersion).toBe(true);
  });

  it("marks orphaned when the quote is nowhere on the page", () => {
    document.body.innerHTML = "<p>unrelated content</p>";
    const out = locate(document, stored({ rootSelector: '[id="gone"]' }));
    expect(out.projection.status).toBe("orphaned");
  });
});

describe("orphanAnno", () => {
  it("projects a comment as orphaned/unplaceable", () => {
    const c = stored({ rootSelector: "#gone" });
    const located = orphanAnno(c);
    expect(located.projection).toEqual({
      status: "orphaned",
      start: null,
      end: null,
      pastVersion: true,
    });
    expect(located.comment).toBe(c);
  });
});
