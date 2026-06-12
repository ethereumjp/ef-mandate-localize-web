import { fetchAnno } from "@commentary/core/anno/read";
import { loadMockComments } from "@commentary/core/anno/mock";
import { canonicalizeUrl } from "@commentary/core/anno/canonicalUrl";
import {
  commentsForUrl,
  projectAnno,
  type StoredAnno,
  type LocatedAnno,
} from "@commentary/core/anno/locate";
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
  dispose(): void;
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
  const byBlock = new Map<string, LocatedAnno[]>();
  let stored: StoredAnno[] = [];
  let visible = false;
  let clickCb: ((uid: string) => void) | null = null;

  function pageScoped(): StoredAnno[] {
    return commentsForUrl(stored, canonicalizeUrl(location.href).urlCanonical);
  }

  function paint(): void {
    byBlock.clear();
    if (!visible) {
      applyHighlights("comment", []);
      applyHighlights("comment-focus", []);
      return;
    }
    const groups = new Map<string, StoredAnno[]>();
    for (const c of pageScoped()) {
      const arr = groups.get(c.rootSelector) ?? [];
      arr.push(c);
      groups.set(c.rootSelector, arr);
    }
    const ranges: Range[] = [];
    for (const [rootSelector, group] of groups) {
      const blockEl = document.querySelector(rootSelector);
      if (!blockEl) continue;
      const items = projectAnno(blockEl, group);
      byBlock.set(rootSelector, items);
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
    for (const [rootSelector, group] of byBlock) {
      const blockEl = document.querySelector(rootSelector);
      if (!blockEl || !blockEl.contains(pos.node)) continue;
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
      stored = opts.mock
        ? loadMockComments()
        : await fetchAnno(opts.schemaUid, { endpoint: opts.easGraphql });
      paint();
    },
    setVisible(on: boolean) {
      visible = on;
      paint();
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
    dispose() {
      document.removeEventListener("click", onDocClick);
      applyHighlights("comment", []);
      applyHighlights("comment-focus", []);
      byBlock.clear();
    },
  };
}
