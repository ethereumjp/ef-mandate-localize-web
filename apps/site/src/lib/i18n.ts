export type Lang = "en" | "ja";

export const LANGS: Lang[] = ["en", "ja"];

/** The authoritative source language. All others are translations of it. */
export const SOURCE_LANG: Lang = "en";

/**
 * Prefix a root-relative path with the site's base path. Astro's BASE_URL may or
 * may not carry a trailing slash depending on config, so normalize both sides and
 * always join with exactly one "/". `withBase("")` → the site root.
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}

/**
 * Route for a language: the source language lives at the site root, others at
 * "<base>/<code>". Base-prefixed so links work under a GitHub Pages project
 * subpath as well as at domain root.
 */
export function langRoute(code: Lang): string {
  return code === SOURCE_LANG ? withBase("") : withBase(code);
}

/** Language switcher options (endonym label). Add a row per new language. */
export const LANG_OPTIONS: { code: Lang; label: string; route: string }[] = [
  { code: "en", label: "English", route: langRoute("en") },
  { code: "ja", label: "日本語", route: langRoute("ja") },
];

/** EN is the only complete, required dictionary; other languages may be partial. */
const EN_MESSAGES = {
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
  pending: "This chapter isn't translated yet — showing the original (English).",
  home: "Home",
  sourceCode: "Source code",
  originalPdf: "Original PDF",
  projectNote: "A community localization of the EF Mandate — not an official EF translation.",
} as const;

export type MessageKey = keyof typeof EN_MESSAGES;

type MessageTable = { en: Record<MessageKey, string> } & Partial<
  Record<Lang, Partial<Record<MessageKey, string>>>
>;

const _MESSAGES: MessageTable = {
  en: EN_MESSAGES,
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
    pending: "この章はまだ翻訳されていません — 原文（英語）を表示しています。",
    home: "ホーム",
    sourceCode: "ソースコード",
    originalPdf: "原文PDF",
    projectNote:
      "EF Mandate のコミュニティによる日本語ローカライズです（EF 公式翻訳ではありません）。",
  },
};

/**
 * Look up `key` for `lang` in `table`, falling back to `fallbackLang`'s entry
 * when the language or key is missing. Generic over the table for testability.
 */
export function resolveMessage(
  table: Partial<Record<string, Partial<Record<string, string>>>>,
  fallbackLang: string,
  lang: string,
  key: string,
): string {
  return table[lang]?.[key] ?? table[fallbackLang]?.[key] ?? key;
}

/** Translate UI message `k` for `lang`, falling back to the source language. */
export const t = (lang: Lang, k: MessageKey): string =>
  resolveMessage(_MESSAGES, SOURCE_LANG, lang, k);

/**
 * Full per-language message table with EN fallback applied.
 * Exposed for legacy consumers; prefer `t()` for new code.
 */
export const MESSAGES: Record<Lang, Record<MessageKey, string>> = Object.fromEntries(
  LANGS.map((lang) => [
    lang,
    Object.fromEntries((Object.keys(EN_MESSAGES) as MessageKey[]).map((k) => [k, t(lang, k)])),
  ]),
) as Record<Lang, Record<MessageKey, string>>;
