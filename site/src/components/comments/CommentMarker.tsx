interface Props {
  count: number;
  pending: boolean;
  onClick: () => void;
}

/** Gutter badge: opens the thread panel for a block. Shows a pending dot while
 *  any of the block's comments is still an unconfirmed (optimistic) attestation. */
export function CommentMarker({ count, pending, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${count} comment${count === 1 ? "" : "s"}`}
      className="inline-flex items-center gap-0.5 rounded text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
    >
      💬 {count}
      {pending ? (
        <span aria-hidden className="inline-block size-1.5 rounded-full bg-amber-500" />
      ) : null}
    </button>
  );
}
