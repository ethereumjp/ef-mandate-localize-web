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

/** Default amount of surrounding context (in code points) captured per side. */
export const CONTEXT_LEN = 32;

/**
 * Build an anchor for a [start, end) code-point span of a block's normalized text.
 * Called at authoring time (M4). `blockHash` is the hash of the same normalized text.
 *
 * IMPORTANT: pass NFC-normalized text — the same `normalizeBlockText` output the
 * `blockHash` is computed over. `project` matches `exact` verbatim, so a non-normalized
 * quote would silently degrade to `needs-review`.
 *
 * Field mapping for M4/EAS: this `Anchor`'s `exact` / `prefix` / `suffix` / `start` / `end`
 * correspond to the schema fields `spanExact` / `spanPrefix` / `spanSuffix` / `spanStart` /
 * `spanEnd` (spec §7).
 */
export function makeAnchor(
  blockHash: `0x${string}`,
  text: string,
  start: number,
  end: number,
  contextLen: number = CONTEXT_LEN,
): Anchor {
  const cps = codePoints(text);
  if (start < 0 || end > cps.length || start >= end) {
    throw new Error(`invalid span [${start}, ${end}) for text of length ${cps.length}`);
  }
  return {
    blockHash,
    exact: cps.slice(start, end).join(""),
    prefix: cps.slice(Math.max(0, start - contextLen), start).join(""),
    suffix: cps.slice(end, end + contextLen).join(""),
    start,
    end,
  };
}

/**
 * Project a stored anchor onto the current block (or null if the block is gone).
 * Immutable attestations are never moved; this is the derived current-version view.
 */
export function project(anchor: Anchor, current: CurrentBlock | null): Projection {
  // Block no longer exists in the current version.
  if (current === null) {
    return { status: "orphaned", start: null, end: null, pastVersion: true };
  }

  const pastVersion = anchor.blockHash !== current.blockHash;

  // Block unchanged since authoring → the stored offsets are still valid verbatim.
  if (!pastVersion) {
    return { status: "anchored", start: anchor.start, end: anchor.end, pastVersion: false };
  }

  // Block changed → re-match the quoted span by exact text.
  const cps = codePoints(current.text);
  const exact = codePoints(anchor.exact);
  const candidates = findOccurrences(cps, exact);

  // The quoted text itself was edited or removed — don't guess a location.
  if (candidates.length === 0) {
    return { status: "needs-review", start: null, end: null, pastVersion: true };
  }

  let idx: number;
  if (candidates.length === 1) {
    idx = candidates[0];
  } else {
    // Multiple occurrences → keep only those whose surrounding context matches.
    const byContext = candidates.filter((c) =>
      contextMatches(cps, c, exact.length, anchor.prefix, anchor.suffix),
    );
    if (byContext.length !== 1) {
      return { status: "needs-review", start: null, end: null, pastVersion: true };
    }
    idx = byContext[0];
  }

  return { status: "re-anchored", start: idx, end: idx + exact.length, pastVersion: true };
}

/** Does the text around `idx` match the anchor's captured prefix/suffix context? */
function contextMatches(
  cps: string[],
  idx: number,
  exactLen: number,
  prefix: string,
  suffix: string,
): boolean {
  const pre = codePoints(prefix);
  const suf = codePoints(suffix);
  // Compare as many context code points as are available on each side.
  const k = Math.min(pre.length, idx);
  for (let j = 0; j < k; j++) {
    if (cps[idx - k + j] !== pre[pre.length - k + j]) return false;
  }
  const end = idx + exactLen;
  const m = Math.min(suf.length, cps.length - end);
  for (let j = 0; j < m; j++) {
    if (cps[end + j] !== suf[j]) return false;
  }
  return true;
}
