import { fetchAnno } from "@anno/core/anno/read";
import { loadMockComments } from "@anno/core/anno/mock";
import { canonicalizeUrl } from "@anno/core/anno/canonicalUrl";
import { pageKey } from "@anno/core/anno/pageKey";
import {
  commentsForUrl,
  projectAnno,
  type StoredAnno,
  type LocatedAnno,
} from "@anno/core/anno/locate";
import { resolveContainer } from "@anno/core/anno/selector";
import { applyHighlights, rangeForOffsets } from "./web3/highlight";

export interface DisplayOpts {
  schemaUid: string;
  easGraphql?: string;
  mock?: boolean;
}

export interface Display {
  /** Fetch stored comments for this page and (re)paint. */
  refresh(): Promise<void>;
  /** Show or hide the highlight markers. */
  setVisible(on: boolean): void;
  /** Number of comments scoped to this page's canonical URL. */
  count(): number;
  /** The projected comments currently anchored on the page (for the panel list). */
  projected(): LocatedAnno[];
  /** Register a callback for clicks that land on an anchored comment span. */
  onClickHighlight(cb: (uid: string) => void): void;
  /** Focus a comment: wash its span (comment-focus) + scroll it into view; null clears. */
  focus(uid: string | null): void;
  dispose(): void;
}

/**
 * Resolve each page-scoped comment to its live container (rootSelector → quote
 * fallback via resolveContainer) and project its span. Keyed by the resolved
 * Element so paint/focus/hit-test never re-run a stale stored selector. Pure of
 * visibility/painting, so the list + count work even while highlights are hidden.
 * Block-ID-free: a stale or empty rootSelector still anchors by quote.
 */
export function projectComments(
  stored: StoredAnno[],
  urlCanonical: string,
): Map<Element, LocatedAnno[]> {
  const groups = new Map<Element, StoredAnno[]>();
  for (const c of commentsForUrl(stored, urlCanonical)) {
    const el = resolveContainer(document, c.rootSelector, c.spanExact);
    if (!el) continue;
    const arr = groups.get(el);
    if (arr) arr.push(c);
    else groups.set(el, [c]);
  }
  const byBlock = new Map<Element, LocatedAnno[]>();
  for (const [el, group] of groups) byBlock.set(el, projectAnno(el, group));
  return byBlock;
}

/** The caret (node, offset) under a viewport point — used to hit-test span clicks. */
function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (d.caretRangeFromPoint) {
    const r = d.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

/**
 * Framework-free read/display controller for Stage 1 (the loader): fetch stored
 * comments for this page, project them onto the live DOM, paint the underline
 * markers via the Custom Highlight API, and hit-test span clicks. No React, no
 * wallet, no EAS SDK — mirrors the read path of `CommentController` without the
 * optimistic/authoring state, so the loader can show comments before the heavy
 * app loads.
 */
export function createDisplay(opts: DisplayOpts): Display {
  let byBlock = new Map<Element, LocatedAnno[]>();
  let stored: StoredAnno[] = [];
  let visible = false;
  let clickCb: ((uid: string) => void) | null = null;

  function pageScoped(): StoredAnno[] {
    return commentsForUrl(stored, canonicalizeUrl(location.href).urlCanonical);
  }

  // Always rebuild the projection (list/count data), regardless of visibility.
  function project(): void {
    byBlock = projectComments(stored, canonicalizeUrl(location.href).urlCanonical);
  }

  // Paint (or clear) the underline markers; gated by `visible` only.
  function paintHighlights(): void {
    if (!visible) {
      applyHighlights("comment", []);
      applyHighlights("comment-focus", []);
      return;
    }
    const ranges: Range[] = [];
    for (const [blockEl, items] of byBlock) {
      for (const p of items) {
        const s = p.projection.status;
        if (s !== "anchored" && s !== "re-anchored") continue;
        if (p.projection.start === null || p.projection.end === null) continue;
        const r = rangeForOffsets(blockEl, p.projection.start, p.projection.end);
        if (r) ranges.push(r);
      }
    }
    applyHighlights("comment", ranges);
  }

  function onDocClick(e: MouseEvent): void {
    if (!visible || !clickCb) return;
    const pos = caretFromPoint(e.clientX, e.clientY);
    if (!pos) return;
    for (const [blockEl, group] of byBlock) {
      if (!blockEl.contains(pos.node)) continue;
      for (const p of group) {
        if (p.projection.start === null || p.projection.end === null) continue;
        const r = rangeForOffsets(blockEl, p.projection.start, p.projection.end);
        if (r && r.comparePoint(pos.node, pos.offset) === 0) {
          clickCb(p.comment.uid);
          return;
        }
      }
    }
  }

  document.addEventListener("click", onDocClick);

  return {
    async refresh() {
      if (opts.mock) {
        stored = loadMockComments();
      } else {
        const { urlCanonical } = canonicalizeUrl(location.href);
        stored = await fetchAnno(opts.schemaUid, {
          pageKey: pageKey(urlCanonical),
          endpoint: opts.easGraphql,
        });
      }
      project();
      paintHighlights();
    },
    setVisible(on: boolean) {
      visible = on;
      paintHighlights();
    },
    count() {
      return pageScoped().length;
    },
    projected() {
      return [...byBlock.values()].flat();
    },
    onClickHighlight(cb) {
      clickCb = cb;
    },
    focus(uid: string | null) {
      if (!uid) {
        applyHighlights("comment-focus", []);
        return;
      }
      for (const [blockEl, group] of byBlock) {
        const located = group.find((p) => p.comment.uid === uid);
        if (!located) continue;
        if (located.projection.start === null || located.projection.end === null) return;
        const r = rangeForOffsets(blockEl, located.projection.start, located.projection.end);
        if (r) {
          applyHighlights("comment-focus", [r]);
          blockEl.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        return;
      }
    },
    dispose() {
      document.removeEventListener("click", onDocClick);
      applyHighlights("comment", []);
      applyHighlights("comment-focus", []);
      byBlock = new Map();
    },
  };
}
