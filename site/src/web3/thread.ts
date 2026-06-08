import type { StoredComment } from "./read";

export interface CommentNode {
  comment: StoredComment;
  replies: CommentNode[];
}

const ZERO_UID = "0x" + "00".repeat(32);

/** Build reply trees by `parentUid`. Zero parent (or unknown parent) = top-level. */
export function buildThreads(comments: StoredComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  for (const c of comments) nodes.set(c.uid, { comment: c, replies: [] });

  const roots: CommentNode[] = [];
  for (const c of comments) {
    const node = nodes.get(c.uid)!;
    const parent = c.parentUid !== ZERO_UID ? nodes.get(c.parentUid) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}
