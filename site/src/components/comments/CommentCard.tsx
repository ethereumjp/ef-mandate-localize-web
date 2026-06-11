import type { CommentNode } from "../../web3/thread";
import type { Projection } from "../../lib/anchoring";
import { MESSAGES, type Lang } from "../../lib/i18n";
import { AnchorStatusBadge } from "./AnchorStatusBadge";

function short(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

interface Props {
  node: CommentNode;
  projection?: Projection;
  lang: Lang;
  depth?: number;
}

export function CommentCard({ node, projection, lang, depth = 0 }: Props) {
  const m = MESSAGES[lang];
  const c = node.comment;
  return (
    <div
      className={depth > 0 ? "mt-3 border-l border-stone-200 pl-3 dark:border-stone-700" : "mt-3"}
    >
      {depth === 0 ? (
        <blockquote className="border-l-2 border-amber-300 pl-2 text-xs text-stone-500 dark:text-stone-400">
          {c.spanExact}
        </blockquote>
      ) : null}
      <p className="mt-1 whitespace-pre-wrap text-sm text-stone-800 dark:text-stone-100">
        {c.body}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-400">
        <span className="font-mono">{short(c.attester)}</span>
        {c.time > 0 ? (
          <span>
            {new Date(c.time * 1000).toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US")}
          </span>
        ) : null}
        {projection ? <AnchorStatusBadge status={projection.status} lang={lang} /> : null}
        {projection?.pastVersion ? (
          <span className="text-amber-600 dark:text-amber-400">{m.pastVersion}</span>
        ) : null}
        <button type="button" disabled className="cursor-not-allowed opacity-50">
          {m.reply}
        </button>
      </div>
      {node.replies.map((r) => (
        <CommentCard key={r.comment.uid} node={r} lang={lang} depth={depth + 1} />
      ))}
    </div>
  );
}
