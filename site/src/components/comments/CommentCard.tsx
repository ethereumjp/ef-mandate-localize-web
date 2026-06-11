import type { CommentNode } from "../../web3/thread";
import type { StoredAnno } from "../../anno/locate";
import type { Projection } from "../../lib/anchoring";
import { MESSAGES, type Lang } from "../../lib/i18n";
import { AnchorStatusBadge } from "./AnchorStatusBadge";

function short(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

interface Props {
  node: CommentNode<StoredAnno>;
  projection?: Projection;
  lang: Lang;
  depth?: number;
  focusedUid?: string | null;
  pendingUids?: Set<string>;
  onFocus?: (uid: string) => void;
}

export function CommentCard({
  node,
  projection,
  lang,
  depth = 0,
  focusedUid,
  pendingUids,
  onFocus,
}: Props) {
  const m = MESSAGES[lang];
  const c = node.comment;
  const focused = depth === 0 && focusedUid === c.uid;
  const pending = pendingUids?.has(c.uid) ?? false;
  return (
    <div
      data-uid={depth === 0 ? c.uid : undefined}
      onClick={depth === 0 ? () => onFocus?.(c.uid) : undefined}
      className={
        depth > 0
          ? "mt-3 border-l border-stone-200 pl-3 dark:border-stone-700"
          : `cursor-pointer rounded-r border-l-3 px-3.5 py-4 transition-colors ${
              focused
                ? "border-stone-400 bg-stone-100/70 dark:border-stone-500 dark:bg-stone-800/60"
                : "border-transparent hover:bg-stone-50 dark:hover:bg-stone-800/40"
            }`
      }
    >
      {depth === 0 ? (
        <blockquote className="line-clamp-1 border-l border-amber-300/80 pl-2 text-xs leading-snug text-stone-400 dark:border-amber-500/50 dark:text-stone-500">
          {c.spanExact}
        </blockquote>
      ) : null}
      <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-stone-700 dark:text-stone-200">
        {c.body}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
        <span className="font-mono">{short(c.attester)}</span>
        {c.time > 0 ? <span>{new Date(c.time * 1000).toLocaleDateString(lang)}</span> : null}
        {projection ? <AnchorStatusBadge status={projection.status} lang={lang} /> : null}
        {projection?.pastVersion ? (
          <span className="text-amber-600 dark:text-amber-400">{m.pastVersion}</span>
        ) : null}
        {pending ? (
          <span
            aria-hidden
            className="inline-block size-1.5 animate-pulse rounded-full bg-amber-500"
          />
        ) : null}
        <button
          type="button"
          disabled
          onClick={(e) => e.stopPropagation()}
          className="cursor-not-allowed opacity-50"
        >
          {m.reply}
        </button>
      </div>
      {node.replies.map((r) => (
        <CommentCard
          key={r.comment.uid}
          node={r}
          lang={lang}
          depth={depth + 1}
          focusedUid={focusedUid}
          pendingUids={pendingUids}
          onFocus={onFocus}
        />
      ))}
    </div>
  );
}
