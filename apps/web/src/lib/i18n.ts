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
 * "<base>/<code>". Base-prefixed so links work under a subpath deploy as well
 * as at domain root.
 */
export function langRoute(code: Lang): string {
  return code === SOURCE_LANG ? withBase("") : withBase(code);
}

/** Language switcher options (endonym label). Add a row per new language. */
export const LANG_OPTIONS: { code: Lang; label: string; route: string }[] = [
  { code: "en", label: "English", route: langRoute("en") },
  { code: "ja", label: "日本語", route: langRoute("ja") },
];

/** Open Graph locale (ll_CC) per language. Add a row per new language. */
const OG_LOCALES: Record<Lang, string> = {
  en: "en_US",
  ja: "ja_JP",
};

export const ogLocale = (lang: Lang): string => OG_LOCALES[lang] ?? lang;

/** EN is the only complete, required dictionary; other languages may be partial. */
const EN_MESSAGES = {
  siteTitle: "EF Mandate",
  siteDescription:
    "A community localization of the EF Mandate — read the original and translations side by side, with on-chain annotations as EAS attestations on Ethereum.",
  index: "Chapters",
  backToIndex: "Back to index",
  language: "Language",
  pending: "This chapter isn't translated yet — showing the original (English).",
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
    siteDescription:
      "EF Mandate のコミュニティ・ローカライズ — 原文と翻訳を対訳で読めます。Ethereum 上の EAS アテステーションによるオンチェーン注釈付き。",
    index: "目次",
    backToIndex: "目次へ戻る",
    language: "言語",
    pending: "この章はまだ翻訳されていません — 原文（英語）を表示しています。",
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
