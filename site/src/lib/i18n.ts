export type Lang = "en" | "ja";

export const LANGS: Lang[] = ["en", "ja"];

/** Language switcher options (route + endonym label). Add a row per new language. */
export const LANG_OPTIONS: { code: Lang; label: string; route: string }[] = [
  { code: "en", label: "English", route: "/" },
  { code: "ja", label: "日本語", route: "/ja" },
];

export const MESSAGES = {
  en: {
    siteTitle: "EF Mandate",
    index: "Chapters",
    backToIndex: "Back to index",
    language: "Language",
    comments: "Comments",
    pastVersion: "Comment for past version",
    statusReanchored: "Re-anchored",
    statusNeedsReview: "Needs review",
    statusOrphaned: "Block removed",
    reply: "Reply",
    threadTitle: "Comments",
    noComments: "No comments on this block yet.",
    needsReviewTitle: "Needs review (text changed)",
    on: "On",
    off: "Off",
    jaPending: "This chapter isn't translated to Japanese yet — showing English.",
    home: "Home",
    sourceCode: "Source code",
    originalPdf: "Original PDF",
    projectNote: "A community localization of the EF Mandate — not an official EF translation.",
  },
  ja: {
    siteTitle: "EF Mandate",
    index: "目次",
    backToIndex: "目次へ戻る",
    language: "言語",
    comments: "コメント",
    pastVersion: "過去のバージョンに対するコメント",
    statusReanchored: "再アンカリング",
    statusNeedsReview: "要確認",
    statusOrphaned: "ブロックが削除されました",
    reply: "返信",
    threadTitle: "コメント",
    noComments: "このブロックにはまだコメントがありません。",
    needsReviewTitle: "要確認（本文が変更されました）",
    on: "オン",
    off: "オフ",
    jaPending: "この章はまだ日本語訳がありません — 英語を表示しています。",
    home: "ホーム",
    sourceCode: "ソースコード",
    originalPdf: "原文PDF",
    projectNote:
      "EF Mandate のコミュニティによる日本語ローカライズです（EF 公式翻訳ではありません）。",
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)["en"];
