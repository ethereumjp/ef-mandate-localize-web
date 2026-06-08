// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { rangeForOffsets } from "../src/web3/highlight";

function blockEl(html: string) {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

describe("rangeForOffsets", () => {
  it("maps normalized offsets to a DOM range over plain text", () => {
    const el = blockEl("the walkaway test"); // normalized == raw
    const r = rangeForOffsets(el, 4, 12);
    expect(r?.toString()).toBe("walkaway");
  });

  it("accounts for leading-whitespace trim", () => {
    const el = blockEl("  the walkaway test"); // 2 leading spaces trimmed by normalize
    const r = rangeForOffsets(el, 4, 12);
    expect(r?.toString()).toBe("walkaway");
  });

  it("spans across inline element boundaries", () => {
    const el = blockEl("a <strong>bold</strong> word"); // textContent "a bold word"
    const r = rangeForOffsets(el, 2, 6); // "bold"
    expect(r?.toString()).toBe("bold");
  });

  it("returns null for an out-of-range span", () => {
    const el = blockEl("abc");
    expect(rangeForOffsets(el, 1, 99)).toBeNull();
  });
});
