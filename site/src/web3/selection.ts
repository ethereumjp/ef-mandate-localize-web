import { normalizeBlockText, codePointLength } from "../lib/normalize";
import { blockHash } from "../lib/hash";
import { makeAnchor, type Anchor } from "../lib/anchoring";

/** The normalized, rendered text of a block element (what the reader selects over). */
export function normalizedBlockText(blockEl: Element): string {
  return normalizeBlockText(blockEl.textContent ?? "");
}

export interface SelectionOffsets {
  start: number;
  end: number;
  exact: string;
}

/**
 * Map a DOM Range to code-point [start,end) offsets in the block's normalized text.
 * Returns null for collapsed ranges or ranges not fully inside the block.
 */
export function selectionToOffsets(blockEl: Element, range: Range): SelectionOffsets | null {
  if (range.collapsed) return null;
  if (!blockEl.contains(range.startContainer) || !blockEl.contains(range.endContainer)) {
    return null;
  }

  // Compute the raw prefix text (everything in the block before the selection start).
  const before = range.cloneRange();
  before.selectNodeContents(blockEl);
  before.setEnd(range.startContainer, range.startOffset);
  const rawPrefix = before.toString();

  // The normalized block text trims the whole block, so we must account for
  // leading characters that get trimmed from the raw block text.
  const rawBlock = blockEl.textContent ?? "";
  const normalizedBlock = normalizeBlockText(rawBlock);
  // Find how many raw code points were trimmed from the front.
  const rawCps = [...rawBlock];
  const normCps = [...normalizedBlock];
  let leadTrim = 0;
  while (leadTrim < rawCps.length && rawCps[leadTrim] !== normCps[0]) {
    leadTrim++;
  }

  // start = code-point count of the prefix after accounting for leading trim
  const prefixCps = codePointLength(rawPrefix) - leadTrim;
  const start = Math.max(0, prefixCps);

  const exact = normalizeBlockText(range.toString());
  if (exact.length === 0) return null;
  const end = start + codePointLength(exact);
  return { start, end, exact };
}

/** Build a full M3 anchor for a selection within a block. */
export function anchorFromSelection(blockEl: Element, range: Range): Anchor | null {
  const offsets = selectionToOffsets(blockEl, range);
  if (offsets === null) return null;
  const text = normalizedBlockText(blockEl);
  return makeAnchor(blockHash(text), text, offsets.start, offsets.end);
}
