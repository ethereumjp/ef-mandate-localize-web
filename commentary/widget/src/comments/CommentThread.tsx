import { useEffect, useRef } from "react";
import type { LocatedAnno } from "@commentary/core/anno/locate";
import { buildThreads } from "../web3/thread";
import { ct } from "./i18n";
import { CommentCard } from "./CommentCard";

interface Props {
  /** All projected comments for the page (document order), threaded by parentUid. */
  comments: LocatedAnno[];
  lang: string;
  focusedUid: string | null;
  pendingUids: Set<string>;
  onFocus: (uid: string) => void;
  onClose: () => void;
}

/**
 * Fixed minimal sidebar listing every comment on the page. Layout-independent
 * (pinned to the viewport, not the host margin) so it works on any site. The
 * amber underline in the text is the in-place marker; this lists + focuses them.
 */
export function CommentThread({
  comments,
  lang,
  focusedUid,
  pendingUids,
  onFocus,
  onClose,
}: Props) {
  const projByUid = new Map(comments.map((p) => [p.comment.uid, p.projection]));
  const threads = buildThreads(comments.map((p) => p.comment));
  const listRef = useRef<HTMLDivElement>(null);

  // When a span is clicked, scroll its card into view.
  useEffect(() => {
    if (!focusedUid || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-uid="${CSS.escape(focusedUid)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedUid]);

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-[340px] max-w-[85vw] flex-col border-l border-stone-200 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          {ct(lang, "threadTitle")}
          {comments.length > 0 ? (
            <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">
              {comments.length}
            </span>
          ) : null}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
        >
          ✕
        </button>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-stone-400">{ct(lang, "noComments")}</p>
        ) : null}
        {threads.map((n) => (
          <CommentCard
            key={n.comment.uid}
            node={n}
            projection={projByUid.get(n.comment.uid)}
            lang={lang}
            focusedUid={focusedUid}
            pendingUids={pendingUids}
            onFocus={onFocus}
          />
        ))}
      </div>
    </aside>
  );
}
