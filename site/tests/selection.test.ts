// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { normalizedBlockText, selectionToOffsets } from "../src/web3/selection";
import { normalizeBlockText } from "../src/lib/normalize";

function blockEl(text: string) {
  const el = document.createElement("div");
  el.textContent = text;
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

  it("returns null when the range is collapsed or outside the block", () => {
    const el = blockEl("abc");
    const node = el.firstChild as Text;
    const collapsed = document.createRange();
    collapsed.setStart(node, 1);
    collapsed.setEnd(node, 1);
    expect(selectionToOffsets(el, collapsed)).toBeNull();
  });
});
