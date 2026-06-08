import type { Comment } from "../../web3/types";

export function CommentMarker({ comments }: { comments: Comment[] }) {
  const pending = comments.some((c) => c.pending);
  return (
    <span
      title={comments.map((c) => c.body).join("\n")}
      className="inline-flex items-center gap-0.5 text-xs text-stone-400"
    >
      💬 {comments.length}
      {pending ? <span className="text-amber-500">…</span> : null}
    </span>
  );
}
