import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "../src/anno/canonicalUrl";

describe("canonicalizeUrl", () => {
  it("strips tracking params but keeps content params", () => {
    const r = canonicalizeUrl("https://Example.com/post?id=42&utm_source=tw&fbclid=xyz");
    expect(r.urlCanonical).toBe("https://example.com/post?id=42");
  });
  it("drops the fragment", () => {
    expect(canonicalizeUrl("https://example.com/a#section").urlCanonical).toBe(
      "https://example.com/a",
    );
  });
  it("removes a trailing slash on non-root paths but keeps root", () => {
    expect(canonicalizeUrl("https://example.com/a/b/").urlCanonical).toBe(
      "https://example.com/a/b",
    );
    expect(canonicalizeUrl("https://example.com/").urlCanonical).toBe("https://example.com/");
  });
  it("is order-independent (deterministic join key)", () => {
    const a = canonicalizeUrl("https://example.com/p?b=2&a=1").urlCanonical;
    const b = canonicalizeUrl("https://example.com/p?a=1&b=2").urlCanonical;
    expect(a).toBe(b);
    expect(a).toBe("https://example.com/p?a=1&b=2");
  });
  it("drops default ports and lowercases host, exposing origin", () => {
    const r = canonicalizeUrl("https://Example.com:443/x");
    expect(r.origin).toBe("https://example.com");
    expect(r.urlCanonical).toBe("https://example.com/x");
    expect(r.url).toBe("https://Example.com:443/x"); // raw preserved
  });
});
