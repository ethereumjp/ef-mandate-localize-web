import { codePoints, findOccurrences } from "../lib/anchoring";
import { normalizedBlockText } from "../web3/selection";

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

/** Nearest id-bearing or block-level ancestor of a node (or the node itself). */
export function nearestContainer(node: Node): Element | null {
  let el: Element | null =
    node.nodeType === 1 ? (node as Element) : node.parentElement;
  for (; el; el = el.parentElement) {
    if (el.id) return el;
    if (BLOCK_TAGS.has(el.tagName)) return el;
  }
  return null;
}

/**
 * A CSS selector that re-selects `el`. Stops at the nearest id-bearing ancestor
 * (ids are the most stable); otherwise walks up to <body> using :nth-of-type.
 */
export function selectorFor(el: Element): string {
  if (el.id) return idSelector(el.id);
  const parts: string[] = [];
  for (let cur: Element | null = el; cur && cur.tagName !== "BODY"; cur = cur.parentElement) {
    if (cur.id) {
      parts.unshift(idSelector(cur.id));
      return parts.join(" > ");
    }
    parts.unshift(`${cur.tagName.toLowerCase()}:nth-of-type(${nthOfType(cur)})`);
  }
  parts.unshift("body");
  return parts.join(" > ");
}

/** Selector for the stable container of `node`, or null if none. */
export function generateSelector(node: Node): string | null {
  const container = nearestContainer(node);
  return container ? selectorFor(container) : null;
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
