// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { nearestContainer, selectorFor } from "../src/anno/selector";

function setBody(html: string): void {
  document.body.innerHTML = html;
}

describe("nearestContainer", () => {
  it("prefers a [data-block-id] ancestor over a closer block-level element", () => {
    setBody(`<div data-block-id="01-p"><div class="prose"><p>hello world</p></div></div>`);
    const p = document.querySelector("p")!;
    const c = nearestContainer(p.firstChild!);
    expect(c?.getAttribute("data-block-id")).toBe("01-p");
  });

  it("falls back to the nearest block-level element when no [data-block-id]/id ancestor", () => {
    setBody(`<section><p>hello world</p></section>`);
    const p = document.querySelector("p")!;
    expect(nearestContainer(p.firstChild!)).toBe(p);
  });
});

describe("selectorFor", () => {
  it("emits a [data-block-id] selector for a marked container", () => {
    setBody(`<div data-block-id="02-h"><p>x</p></div>`);
    const el = document.querySelector("[data-block-id]")!;
    expect(selectorFor(el)).toBe(`[data-block-id="02-h"]`);
  });

  it("emits an [id] selector for an id-bearing element", () => {
    setBody(`<div id="foo"><p>x</p></div>`);
    expect(selectorFor(document.getElementById("foo")!)).toBe(`[id="foo"]`);
  });

  it("walks up with :nth-of-type for unmarked elements", () => {
    setBody(`<section><p>a</p><p>b</p></section>`);
    const second = document.querySelectorAll("p")[1] as Element;
    expect(selectorFor(second)).toBe("body > section:nth-of-type(1) > p:nth-of-type(2)");
  });

  it("stops at the nearest [data-block-id] ancestor when walking up", () => {
    setBody(`<div data-block-id="03"><span><b>x</b></span></div>`);
    const b = document.querySelector("b")!;
    expect(selectorFor(b)).toBe(`[data-block-id="03"] > span:nth-of-type(1) > b:nth-of-type(1)`);
  });
});
