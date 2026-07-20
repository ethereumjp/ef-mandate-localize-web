// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { ensureHighlightStyles } from "../src/highlight";

describe("ensureHighlightStyles", () => {
  it("injects the document-global ::highlight rule once (idempotent)", () => {
    ensureHighlightStyles();
    ensureHighlightStyles();
    const styles = document.head.querySelectorAll("#annotation-highlight-styles");
    expect(styles.length).toBe(1);
    expect(styles[0].textContent).toContain("::highlight(comment)");
  });
});
