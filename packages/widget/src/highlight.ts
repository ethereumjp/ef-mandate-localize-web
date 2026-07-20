// Comment-span highlight styling (the widget's cobalt visual identity). The
// offset→Range mapping lives in @anno/core (lib/anchor-dom `rangeForOffsets`);
// this module only paints the resulting ranges via the CSS Custom Highlight API.
//
// The registry AND its ::highlight() rules are DOCUMENT-global — a shadow-root
// stylesheet can't reach highlighted ranges — so the rule must live in
// document.head. Literal cobalt (#0c0cff), not CSS vars, so highlights render
// identically on any host page. Light-only: the focus wash is a faint cobalt tint
// regardless of host theme.
const HIGHLIGHT_STYLE_ID = "annotation-highlight-styles";
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
