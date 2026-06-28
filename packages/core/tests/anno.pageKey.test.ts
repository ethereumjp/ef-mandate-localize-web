import { describe, it, expect } from "vitest";
import { pageKey } from "../src/anno/pageKey";
import { canonicalizeUrl } from "../src/anno/canonicalUrl";

describe("pageKey", () => {
  it("is deterministic and address-shaped (0x + 40 hex)", () => {
    const k = pageKey("https://example.com/post");
    expect(k).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(pageKey("https://example.com/post")).toBe(k);
  });

  it("differs across distinct canonical pages", () => {
    expect(pageKey("https://example.com/a")).not.toBe(
      pageKey("https://example.com/b"),
    );
  });

  it("collapses tracking params / order / fragment to one key", () => {
    const u1 = canonicalizeUrl("https://example.com/post?utm_source=x&a=1").urlCanonical;
    const u2 = canonicalizeUrl("https://example.com/post?a=1#frag").urlCanonical;
    expect(pageKey(u1)).toBe(pageKey(u2));
  });
});
