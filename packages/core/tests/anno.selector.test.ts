// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { selectorFor, nearestContainer, resolveContainer, findByQuote } from "../src/anno/selector";

function setBody(html: string): void {
  document.body.innerHTML = html;
}

describe("selector generation", () => {
  it("builds an nth-of-type path down from the nearest id-bearing ancestor", () => {
    setBody('<article id="main"><p>one</p><p>two</p><p>three</p></article>');
    const third = document.querySelectorAll("p")[2];
    const sel = selectorFor(third);
    expect(sel).toBe('[id="main"] > p:nth-of-type(3)');
    expect(document.querySelector(sel)).toBe(third);
  });

  it("nearestContainer returns the nearest block-level ancestor", () => {
    setBody("<div><p>hello <em>there</em></p></div>");
    const em = document.querySelector("em")!;
    expect(nearestContainer(em.firstChild!)).toBe(document.querySelector("p"));
  });
});

describe("container resolution", () => {
  it("resolves via the CSS selector when it still matches", () => {
    setBody('<p id="b1">the walkaway test</p>');
    expect(resolveContainer(document, '[id="b1"]', "walkaway")).toBe(document.querySelector("p"));
  });

  it("falls back to the smallest element containing the quote when the selector is stale", () => {
    setBody("<article><p>intro</p><p>see the walkaway test now</p></article>");
    const out = resolveContainer(document, '[id="gone"]', "walkaway test");
    expect(out).toBe(document.querySelectorAll("p")[1]);
  });

  it("fallback returns the block container, not an inline descendant", () => {
    setBody("<p>hello <strong>walkaway</strong> test</p>");
    const out = resolveContainer(document, '[id="gone"]', "walkaway");
    expect(out).toBe(document.querySelector("p"));
  });

  it("findByQuote returns null when the quote is absent", () => {
    setBody("<p>nothing here</p>");
    expect(findByQuote(document, "walkaway")).toBeNull();
  });
});
