import { project, type Anchor, type Projection } from "../lib/anchoring";
import { blockHashFromNormalized } from "../lib/hash";
import { normalizedBlockText } from "../lib/anchor-dom";
import { resolveContainer } from "./selector";
import type { AnnoFields } from "./schema";

/**
 * A stored generalized comment = AnnoFields + EAS attestation envelope
 * (uid / attester / time / refUID read from the on-chain attestation).
 */
export interface StoredAnno extends AnnoFields {
  uid: string;
  attester: string;
  time: number; // unix seconds
  refUID: string; // on-chain reference UID; EMPTY_UID = top-level
}

export interface LocatedAnno {
  comment: StoredAnno;
  projection: Projection;
}

/** View a stored comment's anchor fields as an `Anchor` (containerHash = blockHash). */
function toAnchor(c: AnnoFields): Anchor {
  return {
    blockHash: c.containerHash as `0x${string}`,
    exact: c.spanExact,
    prefix: c.spanPrefix,
    suffix: c.spanSuffix,
    start: c.spanStart,
    end: c.spanEnd,
  };
}

/**
 * Locate one stored comment within `doc` and project its span onto the live
 * container. Resolves the container via `rootSelector` (with quote fallback),
 * then reuses the pure `project()` re-anchoring logic.
 */
export function locate(doc: Document, c: StoredAnno): LocatedAnno {
  const container = resolveContainer(doc, c.rootSelector, c.spanExact);
  if (container === null) {
    return { comment: c, projection: project(toAnchor(c), null) };
  }
  const text = normalizedBlockText(container);
  const current = { blockHash: blockHashFromNormalized(text), text };
  return { comment: c, projection: project(toAnchor(c), current) };
}

/**
 * Project a group of stored comments (already filtered to one block) onto that
 * block's live text: resolve the block's normalized text + hash once, then
 * project each comment's span.
 */
export function projectAnno(blockEl: Element, comments: StoredAnno[]): LocatedAnno[] {
  const text = normalizedBlockText(blockEl);
  const current = { blockHash: blockHashFromNormalized(text), text };
  return comments.map((c) => ({ comment: c, projection: project(toAnchor(c), current) }));
}

/**
 * Scope comments to a single page by canonical URL — the anno identity. The
 * page's `location.href` must be run through the same `canonicalizeUrl` as the
 * stored `urlCanonical` so the keys match.
 */
export function commentsForUrl<T extends { urlCanonical: string }>(
  comments: T[],
  pageUrl: string,
): T[] {
  return comments.filter((c) => c.urlCanonical === pageUrl);
}
