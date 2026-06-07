export type Lang = "en" | "ja";

export const LANGS: Lang[] = ["en", "ja"];

export const MESSAGES = {
  en: {
    siteTitle: "EF Mandate",
    tagline: "Japanese localization with on-chain commentary",
    index: "Index",
    language: "Language",
    comments: "Comments",
    on: "On",
    off: "Off",
    jaPending: "This chapter isn't translated to Japanese yet — showing English.",
    home: "Home",
  },
  ja: {
    siteTitle: "EF Mandate",
    tagline: "オンチェーン・コメンタリー付き日本語ローカライズ",
    index: "目次",
    language: "言語",
    comments: "コメント",
    on: "オン",
    off: "オフ",
    jaPending: "この章はまだ日本語訳がありません — 英語を表示しています。",
    home: "ホーム",
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)["en"];
