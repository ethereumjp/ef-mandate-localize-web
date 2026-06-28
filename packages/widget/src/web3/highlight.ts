import { normalizeBlockText } from "@anno/core/lib/normalize";

// Offsets are compensated for normalization's LEADING trim only. Per-line trailing
// whitespace stripping (rare in browser-rendered prose) can misplace a span — the
// same accepted limitation as selection.ts (M4-5); exact for plain prose.

/** Count leading code points that normalization trims from the block's raw text. */
function leadingTrim(blockEl: Element): number {
  const raw = blockEl.textContent ?? "";
  const norm = normalizeBlockText(raw);
  const rawCps = [...raw];
  const normCps = [...norm];
  if (normCps.length === 0) return rawCps.length;
  let i = 0;
  while (i < rawCps.length && rawCps[i] !== normCps[0]) i++;
  return i;
}

/** Walk text nodes to the (node, nodeOffset) at a given code-point index into textContent. */
function locate(blockEl: Element, rawCpIndex: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
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

/** A DOM Range for normalized code-point [start,end) within blockEl, or null if unplaceable. */
export function rangeForOffsets(blockEl: Element, start: number, end: number): Range | null {
  if (start < 0 || end <= start) return null;
  const lead = leadingTrim(blockEl);
  const a = locate(blockEl, start + lead);
  const b = locate(blockEl, end + lead);
  if (!a || !b) return null;
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  return range;
}

// Comment-span highlight styling. The Custom Highlight API registry AND its
// ::highlight() rules are DOCUMENT-global — a shadow-root stylesheet can't reach
// highlighted ranges — so the rule must live in document.head. Literal cobalt
// (#0c0cff), not CSS vars, so highlights render identically on any host page.
// Light-only: the focus wash is a faint cobalt tint regardless of host theme.
const HIGHLIGHT_STYLE_ID = "commentary-highlight-styles";
const HIGHLIGHT_CSS = `
::highlight(comment){text-decoration-line:underline;text-decoration-color:#0c0cff;text-decoration-thickness:2px;text-underline-offset:3px}
::highlight(comment-focus){background-color:rgba(12,12,255,.10);text-decoration-line:underline;text-decoration-color:#0c0cff;text-decoration-thickness:2px;text-underline-offset:3px}
`;

/** Inject the document-global ::highlight() rules once (idempotent, browser only). */
export function ensureHighlightStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = HIGHLIGHT_CSS;
  document.head.appendChild(style);
}

/** Register highlight ranges via the CSS Custom Highlight API (browser only). */
export function applyHighlights(name: string, ranges: Range[]): void {
  const g = globalThis as unknown as {
    CSS?: { highlights?: Map<string, unknown> };
    Highlight?: new (...r: Range[]) => unknown;
  };
  if (!g.CSS?.highlights || !g.Highlight) return; // unsupported → no inline highlight
  ensureHighlightStyles();
  if (ranges.length === 0) {
    g.CSS.highlights.delete(name);
    return;
  }
  g.CSS.highlights.set(name, new g.Highlight(...ranges));
}
