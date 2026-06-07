import { describe, it, expect } from "vitest";
import { sourceIdHash, chapterNumberFromFilename } from "../src/lib/sources";

describe("sources", () => {
  it("chapterNumberFromFilename reads the two-digit prefix", () => {
    expect(chapterNumberFromFilename("02-ourrole.md")).toBe("02");
    expect(chapterNumberFromFilename("02-財団の役割.md")).toBe("02");
    expect(chapterNumberFromFilename(".DS_Store")).toBeNull();
    expect(chapterNumberFromFilename("readme.md")).toBeNull();
  });
  it("sourceIdHash is a deterministic 0x 32-byte hex", () => {
    const a = sourceIdHash("ethereumjp/ef-mandate-localize-jp@ja");
    const b = sourceIdHash("ethereumjp/ef-mandate-localize-jp@ja");
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).not.toBe(sourceIdHash("other@en"));
  });
});
