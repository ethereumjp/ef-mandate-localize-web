import { describe, it, expect } from "vitest";
import { parseChapter } from "../src/lib/blocks";

describe("parseChapter", () => {
  it("splits on blank lines into blocks", () => {
    const blocks = parseChapter("# Heading\n\nFirst para.\n\nSecond para.");
    expect(blocks.map((b) => b.content)).toEqual(["# Heading", "First para.", "Second para."]);
  });
  it("keeps a single internal newline inside one block", () => {
    const blocks = parseChapter("line one\nline two\n\nnext");
    expect(blocks[0].content).toBe("line one\nline two");
    expect(blocks).toHaveLength(2);
  });
  it("ignores blank-only lines between blocks (incl. CRLF)", () => {
    expect(parseChapter("a\r\n\r\nb").map((b) => b.content)).toEqual(["a", "b"]);
  });
});
