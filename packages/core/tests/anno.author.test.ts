// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { buildAnnoFields } from "../src/anno/author";
import { anchorFromSelection } from "../src/lib/anchor-dom";

function rangeOver(textNode: Node, start: number, end: number): Range {
  const r = document.createRange();
  r.setStart(textNode, start);
  r.setEnd(textNode, end);
  return r;
}

function selectQuote(el: Element, quote: string): Range {
  const text = el.firstChild as Text;
  const idx = (el.textContent ?? "").indexOf(quote);
  const range = document.createRange();
  range.setStart(text, idx);
  range.setEnd(text, idx + quote.length);
  return range;
}

describe("buildAnnoFields", () => {
  it("assembles a full AnnoFields from a selection", () => {
    document.body.innerHTML = '<p id="b1">the walkaway test</p>';
    const p = document.querySelector("p")!;
    const fields = buildAnnoFields({
      href: "https://example.com/x?utm_source=t",
      lang: "en",
      range: selectQuote(p, "walkaway"),
      body: "nice",
    })!;
    expect(fields).not.toBeNull();
    expect(fields.rootSelector).toBe('[id="b1"]');
    expect(fields.urlCanonical).toBe("https://example.com/x");
    expect(fields.origin).toBe("https://example.com");
    expect(fields.spanExact).toBe("walkaway");
    expect(fields.spanStart).toBe(4);
    expect(fields.spanEnd).toBe(12);
    expect(fields.containerHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(fields.meta).toBe("");
  });

  it("returns null when the selection is not inside a container", () => {
    document.body.innerHTML = "<p>hello</p>";
    const range = document.createRange();
    range.selectNodeContents(document.body); // spans, not a single block
    range.collapse(true); // collapsed → no offsets
    expect(buildAnnoFields({ href: "https://e.com/", lang: "en", range, body: "x" })).toBeNull();
  });

  it("returns null for a collapsed selection inside a valid container", () => {
    document.body.innerHTML = '<p id="c1">some text</p>';
    const p = document.querySelector("p")!;
    const range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(true); // valid container, but collapsed → anchor === null (guard 2)
    expect(buildAnnoFields({ href: "https://e.com/", lang: "en", range, body: "x" })).toBeNull();
  });
});

describe("buildAnnoFields on a site-like block", () => {
  it("produces a [data-block-id] rootSelector and matches the legacy block anchor", () => {
    document.body.innerHTML = `<div data-block-id="01-p"><div class="prose"><p>the walkaway test</p></div></div>`;
    const blockDiv = document.querySelector("[data-block-id]")!;
    const text = document.querySelector("p")!.firstChild!;
    const range = rangeOver(text, 4, 12); // "walkaway"

    const fields = buildAnnoFields({ href: "https://x.test/p", lang: "en", range, body: "hi" });
    expect(fields).not.toBeNull();
    expect(fields!.rootSelector).toBe(`[data-block-id="01-p"]`);
    expect(fields!.spanExact).toBe("walkaway");
    expect(fields!.body).toBe("hi");

    const legacy = anchorFromSelection(blockDiv, range)!;
    expect(fields!.containerHash).toBe(legacy.blockHash);
    expect(fields!.spanStart).toBe(legacy.start);
    expect(fields!.spanEnd).toBe(legacy.end);
  });
});
