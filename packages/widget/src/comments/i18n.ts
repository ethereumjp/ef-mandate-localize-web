// Self-contained comment-UI strings, so the comment widget doesn't depend on the
// host site's i18n. `lang` is just the page language (a string); URL already
// distinguishes languages (`/` = en, `/ja` = ja), so comment scoping is by URL.
const STRINGS: Record<string, Record<string, string>> = {
  en: {
    threadTitle: "Comments",
    noComments: "No comments on this block yet.",
    selectToComment: "Select text on the page to comment",
    pastVersion: "Comment for past version",
    unplacedSection: "Couldn’t place in current text",
    reply: "Reply",
    replyingTo: "Replying to",
    statusReanchored: "Re-anchored",
    statusNeedsReview: "Needs review",
    statusOrphaned: "Block removed",
    back: "Comments",
    compose: "New comment",
    composePlaceholder: "Write a comment…",
    onchainDetails: "On-chain record (EAS)",
    publish: "Publish",
    publishing: "Publishing…",
    connectToPublish: "Connect to publish",
  },
  ja: {
    threadTitle: "コメント",
    noComments: "このブロックにはまだコメントがありません。",
    selectToComment: "ページ内のテキストを選択してコメント",
    pastVersion: "過去のバージョンに対するコメント",
    unplacedSection: "現在のテキストに配置できないコメント",
    reply: "返信",
    replyingTo: "返信先:",
    statusReanchored: "再アンカリング",
    statusNeedsReview: "要確認",
    statusOrphaned: "ブロックが削除されました",
    back: "コメント一覧",
    compose: "新規コメント",
    composePlaceholder: "コメントを書く…",
    onchainDetails: "オンチェーン記録 (EAS)",
    publish: "Sepolia に公開",
    publishing: "公開中…",
    connectToPublish: "接続して公開",
  },
};

export type CommentStringKey = keyof (typeof STRINGS)["en"];

/** Translate a comment-UI string for `lang` (any string), falling back to English. */
export function ct(lang: string, key: CommentStringKey): string {
  return STRINGS[lang]?.[key] ?? STRINGS.en[key];
}
