export type Lang = "en" | "ja";

export const LANGS: Lang[] = ["en", "ja"];

export const MESSAGES = {
  en: {
    siteTitle: "EF Mandate",
    index: "Chapters",
    backToIndex: "Back to index",
    language: "Language",
    comments: "Comments",
    on: "On",
    off: "Off",
    jaPending: "This chapter isn't translated to Japanese yet — showing English.",
    home: "Home",
    sourceCode: "Source code",
    originalPdf: "Original PDF",
    projectNote: "A community Japanese localization of the EF Mandate — not an official EF translation.",
  },
  ja: {
    siteTitle: "EF Mandate",
    index: "目次",
    backToIndex: "目次へ戻る",
    language: "言語",
    comments: "コメント",
    on: "オン",
    off: "オフ",
    jaPending: "この章はまだ日本語訳がありません — 英語を表示しています。",
    home: "ホーム",
    sourceCode: "ソースコード",
    originalPdf: "原文PDF",
    projectNote: "EF Mandate のコミュニティによる日本語ローカライズです（EF 公式翻訳ではありません）。",
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)["en"];
