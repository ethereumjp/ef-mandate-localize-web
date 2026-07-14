import { codePoints, findOccurrences } from "../lib/anchoring";
import { normalizedBlockText } from "../lib/anchor-dom";

/** Block-level tags treated as stable comment containers. */
const BLOCK_TAGS = new Set([
  "P",
  "LI",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "ARTICLE",
  "SECTION",
  "ASIDE",
  "FIGCAPTION",
  "TD",
  "TH",
  "DD",
  "DT",
  "PRE",
]);

/** Attribute-form id selector — valid even for ids starting with a digit. */
function idSelector(id: string): string {
  return `[id="${id.replace(/(["\\])/g, "\\$1")}"]`;
}

/** 1-based :nth-of-type index of `el` among same-tag siblings. */
function nthOfType(el: Element): number {
  let n = 1;
  for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
    if (sib.tagName === el.tagName) n++;
  }
  return n;
}

/** Nearest [data-block-id]/id-bearing or block-level ancestor (or the node itself). */
export function nearestContainer(node: Node): Element | null {
  let el: Element | null = node.nodeType === 1 ? (node as Element) : node.parentElement;
  let blockLevel: Element | null = null;
  for (; el; el = el.parentElement) {
    if (el.hasAttribute("data-block-id")) return el; // preferred: stable marker
    if (blockLevel === null && (el.id || BLOCK_TAGS.has(el.tagName))) blockLevel = el;
  }
  return blockLevel;
}

/** `[data-block-id="…"]` selector for a marked element, else null. */
function blockIdSelector(el: Element): string | null {
  const v = el.getAttribute("data-block-id");
  return v ? `[data-block-id="${v.replace(/(["\\])/g, "\\$1")}"]` : null;
}

/**
 * A CSS selector that re-selects `el`. Prefers a `[data-block-id]` marker, then an
 * id; otherwise walks up to <body> with :nth-of-type, stopping at the nearest
 * marker/id ancestor.
 */
export function selectorFor(el: Element): string {
  const ownBid = blockIdSelector(el);
  if (ownBid) return ownBid;
  if (el.id) return idSelector(el.id);
  const parts: string[] = [];
  for (let cur: Element | null = el; cur && cur.tagName !== "BODY"; cur = cur.parentElement) {
    const bid = blockIdSelector(cur);
    if (bid) {
      parts.unshift(bid);
      return parts.join(" > ");
    }
    if (cur.id) {
      parts.unshift(idSelector(cur.id));
      return parts.join(" > ");
    }
    parts.unshift(`${cur.tagName.toLowerCase()}:nth-of-type(${nthOfType(cur)})`);
  }
  parts.unshift("body");
  return parts.join(" > ");
}

/**
 * Resolve the container element for a stored comment: try `rootSelector`, then
 * fall back to the smallest block-level element whose normalized text contains
 * the quote. `rootSelector` may be "" (no stored selector) — that skips straight
 * to the quote fallback.
 */
export function resolveContainer(
  doc: Document,
  rootSelector: string,
  exact: string,
): Element | null {
  if (rootSelector) {
    try {
      const hit = doc.querySelector(rootSelector);
      if (hit) return hit;
    } catch {
      // invalid/stale selector — fall through to the text search
    }
  }
  return findByQuote(doc, exact);
}

/** Smallest block-level element whose normalized text contains `exact` (read-side fallback). */
export function findByQuote(doc: Document, exact: string): Element | null {
  const needle = codePoints(exact);
  if (needle.length === 0 || !doc.body) return null;
  let best: Element | null = null;
  let bestLen = Infinity;
  for (const el of Array.from(doc.body.querySelectorAll<Element>("*"))) {
    // Only block-level elements, to match the author-time `nearestContainer`
    // granularity (an inline <strong> would mismatch the stored containerHash).
    if (!BLOCK_TAGS.has(el.tagName)) continue;
    const text = normalizedBlockText(el);
    if (text.length < bestLen && findOccurrences(codePoints(text), needle).length > 0) {
      best = el;
      bestLen = text.length;
    }
  }
  return best;
}
