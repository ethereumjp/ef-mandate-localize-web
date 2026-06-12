import { describe, it, expect } from "vitest";
import { commentsForUrl } from "../src/anno/locate";

const c = (urlCanonical: string, uid: string) => ({ urlCanonical, uid });

describe("commentsForUrl", () => {
  it("keeps only comments whose canonical URL matches the page (url-scoped, not lang)", () => {
    const all = [c("https://x.test/", "a"), c("https://x.test/ja", "b"), c("https://x.test/", "c")];
    expect(commentsForUrl(all, "https://x.test/").map((x) => x.uid)).toEqual(["a", "c"]);
    expect(commentsForUrl(all, "https://x.test/ja").map((x) => x.uid)).toEqual(["b"]);
  });

  it("returns nothing for a URL with no comments", () => {
    expect(commentsForUrl([c("https://x.test/", "a")], "https://x.test/other")).toEqual([]);
  });
});
