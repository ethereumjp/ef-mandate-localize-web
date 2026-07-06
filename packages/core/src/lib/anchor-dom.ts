import { normalizeBlockText, codePointLength } from "./normalize";
import { blockHash } from "./hash";
import { makeAnchor, type Anchor } from "./anchoring";

/** The normalized, rendered text of a block element (what the reader selects over). */
export function normalizedBlockText(blockEl: Element): string {
  return normalizeBlockText(blockEl.textContent ?? "");
}

/**
 * Count leading code points that normalization trims from the block's raw text.
 * Offsets are stored against the normalized text, so both directions
 * (`selectionToOffsets`, `rangeForOffsets`) compensate for this leading trim.
 */
function leadingTrim(blockEl: Element): number {
  const raw = blockEl.textContent ?? "";
  const rawCps = [...raw];
  const normCps = [...normalizeBlockText(raw)];
  if (normCps.length === 0) return rawCps.length;
  let i = 0;
  while (i < rawCps.length && rawCps[i] !== normCps[0]) i++;
  return i;
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

  // The normalized block text trims the whole block, so account for the leading
  // characters that get trimmed from the raw block text.
  const prefixCps = codePointLength(rawPrefix) - leadingTrim(blockEl);
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

/** Walk text nodes to the (node, nodeOffset) at a given raw code-point index into textContent. */
function locateTextNode(blockEl: Element, rawCpIndex: number): { node: Text; offset: number } | null {
  const walker = blockEl.ownerDocument!.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let remaining = rawCpIndex;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const cps = [...node.data];
    if (remaining <= cps.length) {
      // UTF-16 offset for the first `remaining` code points of this node.
      const utf16 = cps.slice(0, remaining).join("").length;
      return { node, offset: utf16 };
    }
    remaining -= cps.length;
    node = walker.nextNode() as Text | null;
  }
  return null;
}

/**
 * A DOM Range for normalized code-point [start,end) within `blockEl`, or null if
 * unplaceable. The inverse of `selectionToOffsets`: materializes stored offsets
 * back onto the live DOM. Offsets are compensated for normalization's LEADING
 * trim only; per-line trailing-whitespace stripping (rare in browser-rendered
 * prose) can misplace a span — exact for plain prose.
 */
export function rangeForOffsets(blockEl: Element, start: number, end: number): Range | null {
  if (start < 0 || end <= start) return null;
  const lead = leadingTrim(blockEl);
  const a = locateTextNode(blockEl, start + lead);
  const b = locateTextNode(blockEl, end + lead);
  if (!a || !b) return null;
  const range = blockEl.ownerDocument!.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  return range;
}
