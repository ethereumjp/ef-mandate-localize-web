import { describe, it, expect } from "vitest";
import { missingOrDuplicateIds, parityIssues } from "../src/lib/check";
import { parseChapter } from "../src/lib/blocks";

describe("missingOrDuplicateIds", () => {
  it("flags a block without a marker", () => {
    const issues = missingOrDuplicateIds(parseChapter("A"), "en", "02");
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("missing-marker");
  });
  it("flags duplicate ids", () => {
    const src = "<!-- block: 02-p1 -->\nA\n\n<!-- block: 02-p1 -->\nB";
    const issues = missingOrDuplicateIds(parseChapter(src), "en", "02");
    expect(issues.map((i) => i.kind)).toEqual(["duplicate-id"]);
  });
  it("passes a clean chapter", () => {
    const src = "<!-- block: 02-p1 -->\nA\n\n<!-- block: 02-p2 -->\nB";
    expect(missingOrDuplicateIds(parseChapter(src), "en", "02")).toEqual([]);
  });
});

describe("parityIssues", () => {
  it("reports ids missing in / extra in the translation", () => {
    const issues = parityIssues(["02-p1", "02-p2"], ["02-p1", "02-p9"], "ja", "02");
    expect(issues.map((i) => `${i.kind}:${i.detail}`).sort()).toEqual([
      "extra-in-translation:02-p9",
      "missing-in-translation:02-p2",
    ]);
  });
  it("passes when sets are equal", () => {
    expect(parityIssues(["02-p1"], ["02-p1"], "ja", "02")).toEqual([]);
  });
});
