import { project, type Anchor, type Projection } from "../lib/anchoring";
import { blockHash } from "../lib/hash";
import { normalizedBlockText } from "./selection";
import type { StoredComment } from "./read";

/** A stored comment as an M3 Anchor. */
export function toAnchor(c: StoredComment): Anchor {
  return {
    blockHash: c.blockHash as `0x${string}`,
    exact: c.spanExact,
    prefix: c.spanPrefix,
    suffix: c.spanSuffix,
    start: c.spanStart,
    end: c.spanEnd,
  };
}

export interface ProjectedComment {
  comment: StoredComment;
  projection: Projection;
}

/** Project comments (already filtered to this block) onto the block's live text. */
export function projectComments(blockEl: Element, comments: StoredComment[]): ProjectedComment[] {
  const text = normalizedBlockText(blockEl);
  const current = { blockHash: blockHash(text), text };
  return comments.map((c) => ({ comment: c, projection: project(toAnchor(c), current) }));
}
