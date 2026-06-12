import { describe, it, expect } from "vitest";
import { normalizeBlockText, stripMarker, codePointLength } from "../src/lib/normalize";

describe("normalizeBlockText", () => {
  it("strips a leading block marker line", () => {
    expect(normalizeBlockText("<!-- block: 02-p1 -->\nHello")).toBe("Hello");
  });
  it("normalizes CRLF to LF", () => {
    expect(normalizeBlockText("a\r\nb")).toBe("a\nb");
  });
  it("trims trailing whitespace per line and the block ends", () => {
    // first line's leading ws is trimmed by the final trim(); interior leading ws is kept
    expect(normalizeBlockText("  a  \n  b  \n")).toBe("a\n  b");
  });
  it("applies Unicode NFC (combining mark -> precomposed)", () => {
    expect(normalizeBlockText("é")).toBe("é");
  });
  it("counts code points (not UTF-16 units)", () => {
    expect(codePointLength("a\u{1F600}b")).toBe(3);
  });
  it("stripMarker leaves marker-less text untouched", () => {
    expect(stripMarker("no marker here")).toBe("no marker here");
  });
});
