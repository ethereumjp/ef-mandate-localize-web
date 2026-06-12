import { describe, it, expect } from "vitest";
import { formatId, parseIdNumber, nextIdNumber } from "../src/lib/ids";

describe("ids", () => {
  it("formats NN-pM", () => {
    expect(formatId("02", 7)).toBe("02-p7");
  });
  it("parses the numeric suffix", () => {
    expect(parseIdNumber("02-p7")).toBe(7);
    expect(parseIdNumber("garbage")).toBeNull();
  });
  it("nextIdNumber is 1 for an empty set", () => {
    expect(nextIdNumber([])).toBe(1);
  });
  it("nextIdNumber is max+1 and ignores gaps/invalid ids", () => {
    expect(nextIdNumber(["02-p1", "02-p3", "bad"])).toBe(4);
  });
});
