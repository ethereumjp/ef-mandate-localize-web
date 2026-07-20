import { describe, it, expect } from "vitest";
import { shortHex } from "../src/lib/format";

describe("shortHex", () => {
  it("shortens long hex strings with a typographic ellipsis", () => {
    expect(shortHex("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
  it("returns short strings unchanged", () => {
    expect(shortHex("0x1234")).toBe("0x1234");
  });
});
