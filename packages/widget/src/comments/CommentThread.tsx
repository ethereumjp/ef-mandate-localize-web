import { useEffect, useRef } from "react";
import type { LocatedAnno, StoredAnno } from "@anno/core/anno/locate";
import { buildThreads } from "@anno/core/anno/thread";
import { ct } from "./i18n";
import { CommentCard } from "./CommentCard";

interface Props {
  /** All projected comments for the page (document order), threaded by refUID. */
  comments: LocatedAnno[];
  lang: string;
  focusedUid: string | null;
  pendingUids: Set<string>;
  onFocus: (uid: string) => void;
  onReply: (parent: StoredAnno) => void;
}

/** The comment list body (rendered inside Panel). Scrolls a card into view on focus. */
export function CommentThread({
  comments,
  lang,
  focusedUid,
  pendingUids,
  onFocus,
  onReply,
}: Props) {
  const projByUid = new Map(comments.map((p) => [p.comment.uid, p.projection]));
  const threads = buildThreads(comments.map((p) => p.comment));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusedUid || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-uid="${CSS.escape(focusedUid)}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedUid]);

  // Split top-level threads by whether the comment can be placed in the current
  // text. `start === null` means needs-review or orphaned — no inline highlight,
  // so we group those at the bottom. anchored/re-anchored stay in document order.
  const placed: typeof threads = [];
  const unplaced: typeof threads = [];
  for (const n of threads) {
    const proj = projByUid.get(n.comment.uid);
    (proj && proj.start === null ? unplaced : placed).push(n);
  }

  const card = (n: (typeof threads)[number]) => (
    <CommentCard
      key={n.comment.uid}
      node={n}
      projection={projByUid.get(n.comment.uid)}
      lang={lang}
      focusedUid={focusedUid}
      pendingUids={pendingUids}
      onFocus={onFocus}
      onReply={onReply}
    />
  );

  return (
    <div ref={listRef}>
      {comments.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-cobalt/45">
          {ct(lang, "noComments")}
        </p>
      ) : null}
      {placed.map(card)}
      {unplaced.length > 0 ? (
        <>
          <p className="mt-2 border-t border-cobalt/40 px-3.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-cobalt/45">
            <span aria-hidden="true">▸ </span>
            {ct(lang, "unplacedSection")}
          </p>
          {unplaced.map(card)}
        </>
      ) : null}
    </div>
  );
}
