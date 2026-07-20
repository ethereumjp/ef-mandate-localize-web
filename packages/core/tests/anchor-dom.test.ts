// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { normalizedBlockText, rangeForOffsets, selectionToOffsets } from "../src/lib/anchor-dom";
import { normalizeBlockText } from "../src/lib/normalize";

function blockEl(text: string) {
  const el = document.createElement("div");
  el.textContent = text;
  return el;
}

function blockHtml(html: string) {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

describe("selection", () => {
  it("normalizes the block's textContent", () => {
    const el = blockEl("  Our role  ");
    expect(normalizedBlockText(el)).toBe(normalizeBlockText("  Our role  "));
  });

  it("maps a DOM range to code-point offsets in the normalized text", () => {
    const el = blockEl("the walkaway test");
    const node = el.firstChild as Text;
    const range = document.createRange();
    range.setStart(node, 4);
    range.setEnd(node, 12);
    expect(selectionToOffsets(el, range)).toEqual({ start: 4, end: 12, exact: "walkaway" });
  });

  it("accounts for leading-whitespace trim when mapping offsets", () => {
    const el = blockEl("  the walkaway test"); // 2 leading spaces are trimmed by normalize
    const node = el.firstChild as Text;
    const range = document.createRange();
    range.setStart(node, 6); // raw index of "walkaway"
    range.setEnd(node, 14);
    const offsets = selectionToOffsets(el, range);
    expect(offsets).toEqual({ start: 4, end: 12, exact: "walkaway" });
    // invariant: the offsets index the NORMALIZED text to exactly the quote
    const norm = normalizedBlockText(el);
    expect([...norm].slice(offsets!.start, offsets!.end).join("")).toBe("walkaway");
  });

  it("returns null when the range is collapsed or outside the block", () => {
    const el = blockEl("abc");
    const node = el.firstChild as Text;
    const collapsed = document.createRange();
    collapsed.setStart(node, 1);
    collapsed.setEnd(node, 1);
    expect(selectionToOffsets(el, collapsed)).toBeNull();
  });
});

describe("rangeForOffsets", () => {
  it("maps normalized offsets to a DOM range over plain text", () => {
    const el = blockHtml("the walkaway test"); // normalized == raw
    expect(rangeForOffsets(el, 4, 12)?.toString()).toBe("walkaway");
  });

  it("accounts for leading-whitespace trim", () => {
    const el = blockHtml("  the walkaway test"); // 2 leading spaces trimmed by normalize
    expect(rangeForOffsets(el, 4, 12)?.toString()).toBe("walkaway");
  });

  it("spans across inline element boundaries", () => {
    const el = blockHtml("a <strong>bold</strong> word"); // textContent "a bold word"
    expect(rangeForOffsets(el, 2, 6)?.toString()).toBe("bold");
  });

  it("returns null for an out-of-range span", () => {
    const el = blockHtml("abc");
    expect(rangeForOffsets(el, 1, 99)).toBeNull();
  });

  it("round-trips with selectionToOffsets", () => {
    const el = blockHtml("  the walkaway test");
    const range = rangeForOffsets(el, 4, 12)!;
    expect(selectionToOffsets(el, range)).toEqual({ start: 4, end: 12, exact: "walkaway" });
  });
});
