// Self-contained comment-UI strings, so the comment widget doesn't depend on the
// host site's i18n. `lang` is just the page language (a string); URL already
// distinguishes languages (`/` = en, `/ja` = ja), so comment scoping is by URL.
const STRINGS: Record<string, Record<string, string>> = {
  en: {
    threadTitle: "Comments",
    noComments: "No comments on this block yet.",
    pastVersion: "Comment for past version",
    reply: "Reply",
    statusReanchored: "Re-anchored",
    statusNeedsReview: "Needs review",
    statusOrphaned: "Block removed",
  },
  ja: {
    threadTitle: "コメント",
    noComments: "このブロックにはまだコメントがありません。",
    pastVersion: "過去のバージョンに対するコメント",
    reply: "返信",
    statusReanchored: "再アンカリング",
    statusNeedsReview: "要確認",
    statusOrphaned: "ブロックが削除されました",
  },
};

export type CommentStringKey = keyof (typeof STRINGS)["en"];

/** Translate a comment-UI string for `lang` (any string), falling back to English. */
export function ct(lang: string, key: CommentStringKey): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key];
}
