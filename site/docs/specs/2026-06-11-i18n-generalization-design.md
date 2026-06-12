# 多言語コンテンツモデルの一般化 — `ja` 決め打ちから N 言語へ

- 日付: 2026-06-11
- ステータス: 承認済み（design）→ 次段階: 実装プラン（writing-plans）
- 対象リポジトリ: `ef-mandate-localize-jp`（`site/`）
- 関連コード: `site/src/lib/content.ts`, `site/src/lib/i18n.ts`, `site/src/lib/sources.ts`, `site/src/layouts/Reading.astro`, `site/src/styles/global.css`, `site/src/components/{Block,Index,Document,Toolbar,T}.astro`, `site/src/components/comments/CommentCard.tsx`, `site/src/pages/{index,ja}.astro`, `site/config.json`

## 1. 背景と問題

現状は「EN=原文 / JA=翻訳（未訳なら英語へフォールバック）」という**二言語前提**がレンダリング層以降に焼き込まれている。問題の本質は、翻訳側スロットが単一かつ `ja` 接頭辞で固定されている点。3 言語目（fr/zh/ko 等）を足すと破綻する箇所:

| 箇所 | `ja` 決め打ちの内容 |
|---|---|
| `content.ts` | `RenderedBlock.enHtml`/`jaHtml`、`Chapter.title`/`jaTitle`/`jaPending`、`mergeChapter(enBlocks, jaBlocks)`、`loadChapters`（`en` 必須＋`ja` のみ任意取得） |
| `i18n.ts` | `Lang = "en" \| "ja"`、`MESSAGES.jaPending` キー |
| コンポーネント | `lang === "ja" ? (block.jaHtml ?? block.enHtml) : block.enHtml` など三項分岐 |
| `global.css` | `[data-lang="en"] .lang-ja` / `[data-lang="ja"] .lang-en` の 2 本（3 言語目を隠す規則が無い） |
| `pages/` | `index.astro`(`/`) と `ja.astro`(`/ja`) の静的 2 ページ |
| `CommentCard.tsx` | `lang === "ja" ? "ja-JP" : "en-US"`（日付ロケール） |

一方 **`config.json` の `sources` と `sources.ts` の `SourceConfig` は既に `{ lang, path }[]` で汎用**。崩れているのはレンダリング層（`content.ts`）以降のみ。

一般化の核心は **(A) 翻訳側の単一スロットを言語キーのマップに置き換える** ことと、**(B) フォールバック判定を数個のヘルパに集約** して各コンポーネントの三項分岐を消すこと。

## 2. 設計判断（decision log）

| # | 論点 | 決定 | 理由 |
|---|---|---|---|
| Q1 | 動機・作り込みの範囲 | **N 言語対応を動的ルート込みで実装** | 近く具体的な言語を追加する予定がある |
| Q2 | 原文モデル | **EN=原文（authority）を維持。他言語は翻訳で、未訳/不整合なら EN へフォールバック（非対称を維持）** | リポジトリ目的（EF 原文の翻訳）。`loadChapters` が `en` 必須・"pending=英語表示" の現状と一致 |
| Q3 | URL（ルート）形状 | **(a) EN は `/` のまま、他言語は `/[lang]`**（`/ja`, `/fr`, …） | EN の正規 URL を維持し既存リンク/SEO/IPFS 配信を壊さない。新言語はルート 1 本で足りる |
| Q4 | 文字方向 | **LTR のみ。`dir` 対応はスコープ外** | 当面 RTL（アラビア語等）の予定なし。入った時点で別途対応 |
| Q5 | データモデル方式 | **案1: source + translations マップ。`pending` は保持せず派生** | 「原文は必ず存在」の型保証を維持／現行からの移行が最小／フォールバックをヘルパに集約 |
| Q6 | UI 文言（MESSAGES） | **EN のみ必須・完全、他言語は部分可。`t()` で未訳 UI 文言を EN フォールバック** | 本文と同じ「未訳は EN で埋める」挙動で一貫。UI 全訳前に新言語を投入可能 |
| Q7 | UI 文言の出し分け（CSS） | **`LANGS` から hide 規則を生成（`<T>` は prop 不要のまま全言語出力）** | N 言語へ自動対応。`<T>` 約 8 箇所への `lang` prop 配線を回避 |

**却下案:** データモデルで「完全に言語キーのマップ（EN も `Partial<Record<Lang,…>>` の一要素）」は、`html.en` の非 null を型で保証できず `!` が散乱するため却下。「言語ごとに解決済みビューを事前生成」は消費側が最も単純だが EN 本文を全言語フォールバックビューに複製する非正規化コストに見合わず却下。

## 3. データモデル（`content.ts`）

`pending` は**保持せず派生**する（翻訳が揃っている ⇔ `translations` にエントリがある）:

```ts
import type { Lang } from "./i18n"; // "en" = 原文。Lang は i18n.ts を単一の真実源とする

export interface RenderedBlock {
  blockId: string;
  order: number;
  sourceHtml: string;                          // EN（原文・常に存在）
  translations: Partial<Record<Lang, string>>; // 整合した翻訳の描画済み HTML のみ。無い ⇔ 未訳
}

export interface Chapter {
  number: string;
  sourceTitle: string;                                     // EN
  translations: Partial<Record<Lang, { title: string }>>; // entry あり ⇔ その言語は整合済み（非 pending）
  blocks: RenderedBlock[];
}
```

不変条件:
- `RenderedBlock.translations[lang]` が存在する章では、同一章の全ブロックがその `lang` を持つ（章単位の整合判定の結果なので一貫）。
- `"en"` は `translations` に決して現れない（常に `sourceHtml`/`sourceTitle` で参照）。

## 4. 参照ヘルパ（`content.ts`、フォールバックを集約）

各コンポーネントの `lang === "ja" ? …` 三項分岐を、この純関数群へ置換する。`SOURCE_LANG` は `i18n.ts`（§6）で定義し、ここでは import する（二重定義しない）:

```ts
import { SOURCE_LANG } from "./i18n"; // 原文言語の正本は i18n.ts

export const blockHtml = (b: RenderedBlock, lang: Lang): string =>
  lang === SOURCE_LANG ? b.sourceHtml : (b.translations[lang] ?? b.sourceHtml);

export const titleFor = (ch: Chapter, lang: Lang): string =>
  lang === SOURCE_LANG ? ch.sourceTitle : (ch.translations[lang]?.title ?? ch.sourceTitle);

// 翻訳が無く EN にフォールバックしている状態（バナー表示・data-fallback に使用）
export const isPending = (ch: Chapter, lang: Lang): boolean =>
  lang !== SOURCE_LANG && !ch.translations[lang];

export const isFallback = (b: RenderedBlock, lang: Lang): boolean =>
  lang !== SOURCE_LANG && !b.translations[lang];
```

## 5. マージ / ロード（`content.ts`）

- **`mergeChapter(number, enBlocks, translations)`** に一般化。第 3 引数を `Map<Lang, Block[]>`（EN を除く翻訳言語ごとのブロック列）に変更。
  - 既存の整合判定（件数一致 ＋ ID 一意 ＋ ID 集合が EN と一致）を**翻訳言語ごとに独立適用**。
  - 整合した言語だけ `RenderedBlock.translations[lang]` と `Chapter.translations[lang] = { title }` を埋める。不整合な言語は何も格納しない → `isPending`/`isFallback` が真になり EN フォールバック。
- **`loadChapters(configPath)`**:
  - `config.sources` から `lang === "en"` を必須取得（無ければ従来どおり throw）。
  - それ以外の全ソースを走査し、各ソースの章 Map を読む。章番号ごとに `Map<Lang, Block[]>` を組み立て `mergeChapter` に渡す。
  - 既知言語（`i18n.ts` の `Lang`）に無い `config.sources.lang` はスキップし、`console.warn` でビルド時に通知する（型に未登録の言語ソースを黙って取り込まない）。

## 6. i18n（`i18n.ts`）

- `Lang` / `LANGS` / `LANG_OPTIONS` は配列なので**行追加だけ**で拡張。`route` はハードコードをやめ `langRoute(code)` で導出:
  ```ts
  export const SOURCE_LANG: Lang = "en"; // 原文言語の正本。content.ts はここから import（循環依存なし）
  export const langRoute = (code: Lang): string => (code === SOURCE_LANG ? "/" : `/${code}`);
  ```
  → `LANG_OPTIONS` の各行は `{ code, label }` ＋ `route: langRoute(code)`。新言語は code と endonym ラベルを足すだけ。
- **`MESSAGES`**: EN のみ必須・完全、他言語は部分可。`t()` で未訳 UI 文言を EN フォールバック:
  ```ts
  type Messages = { en: Record<MessageKey, string> } & Partial<Record<Lang, Partial<Record<MessageKey, string>>>>;
  export const MESSAGES: Messages = { /* en: 全キー必須。ja 等は部分可 */ };
  export type MessageKey = keyof (typeof MESSAGES)["en"];
  export const t = (lang: Lang, k: MessageKey): string => MESSAGES[lang]?.[k] ?? MESSAGES.en[k];
  ```
- **キー名変更**: `jaPending` → `pending`（言語非依存名）。文言も対象言語名を含めず「原文（英語）を表示」と中立化。
  - 例 EN: `pending: "This chapter isn't translated yet — showing the original (English)."`
  - 例 JA: `pending: "この章はまだ翻訳されていません — 原文（英語）を表示しています。"`

## 7. UI 文言の出し分け（`Reading.astro` + `global.css`）

`global.css` の `[data-lang="en"] .lang-ja` / `[data-lang="ja"] .lang-en` の 2 本を**削除**し、`LANGS` から生成した規則を `Reading.astro` にインライン:

```astro
---
import { LANGS } from "../lib/i18n";
---
<style set:html={LANGS.map((l) => `[data-lang="${l}"] .lang:not(.lang-${l}){display:none}`).join("\n")}></style>
```

挙動: 能動言語 `L` のとき `.lang-L` 以外の `.lang` を全て隠す → N 言語で正しく単一表示。`<T>` は現状のまま（全言語 `<span class="lang lang-*">` 出力・prop 不要）。`<T>` 内部のみ `MESSAGES[lang][k]` → `t(lang, k)` に変更（未訳 EN フォールバック対応）。

## 8. ルーティング（`pages/`）

- `index.astro`（EN, `/`）は維持。
- `ja.astro` を**削除**し、動的ルート **`[lang].astro`** を追加:
  ```astro
  ---
  import Reading from "../layouts/Reading.astro";
  import Document from "../components/Document.astro";
  import { LANGS, SOURCE_LANG, t, LANG_OPTIONS, type Lang } from "../lib/i18n";
  export const getStaticPaths = () =>
    LANGS.filter((l) => l !== SOURCE_LANG).map((lang) => ({ params: { lang } }));
  const lang = Astro.params.lang as Lang;
  const endonym = LANG_OPTIONS.find((o) => o.code === lang)?.label ?? lang;
  const title = `${t(lang, "siteTitle")} · ${endonym}`;
  ---
  <Reading title={title} lang={lang}><Document lang={lang} /></Reading>
  ```
- 静的生成は `getStaticPaths` 列挙分のみ → 未知 lang は 404。EN は `index.astro` 側でタイトル `t("en","siteTitle")`。

## 9. コンポーネント置換

| ファイル | 変更 |
|---|---|
| `Block.astro` | `html = blockHtml(block, lang)`、`data-fallback={isFallback(block, lang) ? "en" : undefined}` |
| `Index.astro` | チャプタ名を `titleFor(ch, lang)` |
| `Document.astro` | pending バナー条件を `isPending(ch, lang)`、`<T k="jaPending" />` → `<T k="pending" />` |
| `Toolbar.astro` | `MESSAGES[lang].x` → `t(lang, "x")`（`LANG_OPTIONS.map`/select は変更不要） |
| `SiteMeta.astro` | `MESSAGES[lang]` 参照を `t(lang, …)` 化 |
| `CommentCard.tsx` | `toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US")` → `toLocaleDateString(lang)`（lang コードは BCP-47 として有効） |

`schema.ts` / `anno/*` の `lang: string`（EAS 属性のページ言語）は既に汎用文字列のため変更不要。

## 10. エラー処理 / 不変条件

- `config.sources` に `en` が無ければ `loadChapters` は throw（現状維持）。
- 翻訳ソース欠如・不整合は **当該章を pending 扱い → EN フォールバック＋バナー**。ページ自体は全既知言語ぶん生成する（未訳章だらけでも EN で読める）。
- `[lang].astro` の `Astro.params.lang` は `getStaticPaths` 列挙値のみ到達するため安全。型は `as Lang`。

## 11. テスト（vitest、現状ゼロ → 純粋ロジックに新規追加）

- `mergeChapter`: 「全言語整合」「一部言語のみ整合」「翻訳ソース欠如」「ブロック数不一致で pending」の各ケースで `translations` の有無を検証。
- `t()`: 未訳キーが EN にフォールバックすること。
- `langRoute()`: `en → "/"`, それ以外 `"/" + code`。
- `.astro` コンポーネントは対象外（ロジックは純関数に切り出し済みのため）。

## 12. 言語追加の手順（一般化の成果）

新言語 `xx` の追加に**コード変更は不要**:

1. `i18n.ts` の `Lang` ユニオン・`LANGS`・`LANG_OPTIONS`（`{ code:"xx", label:"<endonym>" }`）に 1 行追加。`MESSAGES.xx` は任意（未指定キーは EN フォールバック）。
2. `config.json` の `sources` に `{ "lang": "xx", "path": "../source/xx/chapters" }` を追加。
3. `source/xx/chapters/` に翻訳 md を配置（EN とブロック ID 整合が取れた章のみ翻訳表示、未整合章は EN フォールバック）。

## 13. スコープ外（YAGNI）

- RTL（`dir="rtl"`）対応・レイアウト左右反転。
- 全言語を対等に扱う対称モデル（EN は恒久的に原文）。
- 章ごとの個別ルート（現状は全章 1 ページ構成を維持）。
- UI 文言の全訳強制（EN フォールバックで許容）。
- 翻訳ワークフロー・CI による整合チェックの自動化。
