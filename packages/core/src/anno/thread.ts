import { EMPTY_UID } from "./constants";

/** Minimal shape needed to thread comments (any stored-comment type works). */
export interface Threadable {
  uid: string;
  refUID: string;
}

export interface CommentNode<T extends Threadable> {
  comment: T;
  replies: CommentNode<T>[];
}

/** Build reply trees by `refUID`. Empty parent (or unknown parent) = top-level. */
export function buildThreads<T extends Threadable>(comments: T[]): CommentNode<T>[] {
  const nodes = new Map<string, CommentNode<T>>();
  for (const c of comments) nodes.set(c.uid, { comment: c, replies: [] });

  const roots: CommentNode<T>[] = [];
  for (const c of comments) {
    const node = nodes.get(c.uid)!;
    const parent = c.refUID !== EMPTY_UID ? nodes.get(c.refUID) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}
