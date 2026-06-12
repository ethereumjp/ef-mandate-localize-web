import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/lib/render";

describe("renderMarkdown", () => {
  it("renders a heading", () => {
    const html = renderMarkdown("# II. Our Role");
    expect(html).toContain("<h1");
    expect(html).toContain("II. Our Role");
  });
  it("renders bold inline", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });
  it("wraps a plain paragraph in <p>", () => {
    expect(renderMarkdown("hello world")).toContain("<p>hello world</p>");
  });
  it("returns a trimmed string (no trailing newline)", () => {
    expect(renderMarkdown("x")).toBe(renderMarkdown("x").trim());
  });
});
