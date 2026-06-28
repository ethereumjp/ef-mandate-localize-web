import { describe, it, expect } from "vitest";
import { chapterNumberFromFilename } from "../src/lib/sources";

describe("sources", () => {
  it("chapterNumberFromFilename reads the two-digit prefix", () => {
    expect(chapterNumberFromFilename("02-ourrole.md")).toBe("02");
    expect(chapterNumberFromFilename("02-財団の役割.md")).toBe("02");
    expect(chapterNumberFromFilename(".DS_Store")).toBeNull();
    expect(chapterNumberFromFilename("readme.md")).toBeNull();
  });
});
