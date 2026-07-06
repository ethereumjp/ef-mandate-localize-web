// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { projectComments } from "../src/display";
import { blockHash } from "@anno/core/lib/hash";
import { normalizeBlockText } from "@anno/core/lib/normalize";
import type { StoredAnno } from "@anno/core/anno/locate";

const ZERO = "0x" + "00".repeat(32);

function stored(over: Partial<StoredAnno> = {}): StoredAnno {
  const text = "the walkaway test";
  return {
    uid: "0x1",
    attester: "0xabc0000000000000000000000000000000000000",
    time: 0,
    revoked: false,
    url: "https://x/",
    urlCanonical: "https://x/",
    origin: "https://x",
    lang: "en",
    rootSelector: '[data-block-id="t1"]',
    containerHash: blockHash(normalizeBlockText(text)),
    spanStart: 4,
    spanEnd: 12,
    spanExact: "walkaway",
    spanPrefix: "the ",
    spanSuffix: " test",
    refUID: ZERO,
    body: "hi",
    meta: "",
    ...over,
  } as StoredAnno;
}

describe("projectComments", () => {
  it("projects page comments into byBlock (independent of highlight visibility)", () => {
    document.body.innerHTML = '<p data-block-id="t1">the walkaway test</p>';
    const byBlock = projectComments([stored()], "https://x/");
    const items = [...byBlock.values()].flat();
    expect(items).toHaveLength(1);
    expect(items[0].comment.uid).toBe("0x1");
  });

  it("scopes to the page's canonical URL", () => {
    document.body.innerHTML = '<p data-block-id="t1">the walkaway test</p>';
    const byBlock = projectComments([stored({ urlCanonical: "https://other/" })], "https://x/");
    expect([...byBlock.values()].flat()).toHaveLength(0);
  });

  it("anchors via findByQuote when rootSelector is empty/stale", () => {
    document.body.innerHTML = '<p data-block-id="t1">the walkaway test</p>';
    const byBlock = projectComments([stored({ rootSelector: "" })], "https://x/");
    const items = [...byBlock.values()].flat();
    expect(items).toHaveLength(1);
    expect(items[0].comment.uid).toBe("0x1");
    expect(items[0].projection.status).not.toBe("orphaned");
  });
});
