import { describe, it, expect } from "vitest";
import { blockHash, blockHashFromNormalized } from "../src/lib/hash";

const EMPTY_KECCAK = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";

describe("blockHash", () => {
  it("matches the known keccak256 of empty input", () => {
    expect(blockHashFromNormalized("")).toBe(EMPTY_KECCAK);
  });
  it("is invariant to marker, CRLF, and trailing whitespace", () => {
    const a = blockHash("<!-- block: 01-p1 -->\nhello world");
    const b = blockHash("hello world\r\n");
    expect(a).toBe(b);
  });
  it("differs for different text", () => {
    expect(blockHash("alpha")).not.toBe(blockHash("beta"));
  });
  it("returns a 0x-prefixed 32-byte hex string", () => {
    expect(blockHash("x")).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
