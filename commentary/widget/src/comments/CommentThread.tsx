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
}

/** The comment list body (rendered inside Panel). Scrolls a card into view on focus. */
export function CommentThread({ comments, lang, focusedUid, pendingUids, onFocus }: Props) {
  const projByUid = new Map(comments.map((p) => [p.comment.uid, p.projection]));
  const threads = buildThreads(comments.map((p) => p.comment));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusedUid || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-uid="${CSS.escape(focusedUid)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedUid]);

  return (
    <div ref={listRef}>
      {comments.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-cobalt/45">{ct(lang, "noComments")}</p>
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
  );
}
