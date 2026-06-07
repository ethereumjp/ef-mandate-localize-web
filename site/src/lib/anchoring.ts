// Pure re-anchoring: project a stored comment anchor onto the current block text.
// All offsets are Unicode code-point indices over NORMALIZED block text
// (same normalization as M1's normalizeBlockText). Runs in Node and the browser.

/** A stored anchor (what an EAS attestation records, spec §6/§7). */
export interface Anchor {
  /** keccak256 of the normalized block text at authoring time. */
  blockHash: `0x${string}`;
  /** The selected substring (the quote). */
  exact: string;
  /** A few code points of context before / after the quote. */
  prefix: string;
  suffix: string;
  /** Code-point offsets of the quote within the normalized block at authoring. */
  start: number;
  end: number;
}

/** The current state of a block (from M1's anchors.json). */
export interface CurrentBlock {
  blockHash: `0x${string}`;
  text: string;
}

export type AnchorStatus = "anchored" | "re-anchored" | "needs-review" | "orphaned";

export interface Projection {
  status: AnchorStatus;
  /** Code-point offsets into the CURRENT block, or null when unplaceable. */
  start: number | null;
  end: number | null;
  /** True when the block changed since authoring (or is gone): the
   *  "Comment for past version" tag. Only `anchored` is ever false. */
  pastVersion: boolean;
}

/** Split a string into an array of Unicode code points. */
export function codePoints(s: string): string[] {
  return Array.from(s);
}

/** All start indices where `needle` occurs in `haystack` (code-point arrays). */
export function findOccurrences(haystack: string[], needle: string[]): number[] {
  const out: number[] = [];
  if (needle.length === 0) return out;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) out.push(i);
  }
  return out;
}
