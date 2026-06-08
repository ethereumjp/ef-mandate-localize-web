import type { ProjectedComment } from "../../web3/projectComments";
import { buildThreads } from "../../web3/thread";
import { MESSAGES, type Lang } from "../../lib/i18n";
import { CommentCard } from "./CommentCard";

interface Props {
  projected: ProjectedComment[];
  lang: Lang;
  onClose: () => void;
}

export function CommentThread({ projected, lang, onClose }: Props) {
  const m = MESSAGES[lang];
  const isInline = (s: string) => s === "anchored" || s === "re-anchored";
  const inline = projected.filter((p) => isInline(p.projection.status));
  const needsReview = projected.filter((p) => !isInline(p.projection.status));
  const projByUid = new Map(projected.map((p) => [p.comment.uid, p.projection]));
  const inlineThreads = buildThreads(inline.map((p) => p.comment));
  const reviewThreads = buildThreads(needsReview.map((p) => p.comment));

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-80 max-w-[85vw] flex-col overflow-y-auto border-l border-stone-200 bg-white p-4 shadow-lg dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{m.threadTitle}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          ✕
        </button>
      </div>
      {projected.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">{m.noComments}</p>
      ) : null}
      {inlineThreads.map((n) => (
        <CommentCard
          key={n.comment.uid}
          node={n}
          projection={projByUid.get(n.comment.uid)}
          lang={lang}
        />
      ))}
      {reviewThreads.length > 0 ? (
        <>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-stone-400">
            {m.needsReviewTitle}
          </h3>
          {reviewThreads.map((n) => (
            <CommentCard
              key={n.comment.uid}
              node={n}
              projection={projByUid.get(n.comment.uid)}
              lang={lang}
            />
          ))}
        </>
      ) : null}
    </aside>
  );
}
