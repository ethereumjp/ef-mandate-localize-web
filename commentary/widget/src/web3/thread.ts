/** Minimal shape needed to thread comments (any stored-comment type works). */
interface Threadable {
  uid: string;
  parentUid: string;
}

export interface CommentNode<T extends Threadable> {
  comment: T;
  replies: CommentNode<T>[];
}

const ZERO_UID = "0x" + "00".repeat(32);

/** Build reply trees by `parentUid`. Zero parent (or unknown parent) = top-level. */
export function buildThreads<T extends Threadable>(comments: T[]): CommentNode<T>[] {
  const nodes = new Map<string, CommentNode<T>>();
  for (const c of comments) nodes.set(c.uid, { comment: c, replies: [] });

  const roots: CommentNode<T>[] = [];
  for (const c of comments) {
    const node = nodes.get(c.uid)!;
    const parent = c.parentUid !== ZERO_UID ? nodes.get(c.parentUid) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}
