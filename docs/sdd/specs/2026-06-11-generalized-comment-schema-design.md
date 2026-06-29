# 汎用コメント schema 設計 — 任意サイト向け Chrome 拡張への一般化

- 日付: 2026-06-11
- ステータス: 承認済み(design）→ 次段階: 実装プラン（writing-plans）
- 対象リポジトリ: `ef-mandate-localize-jp`（`site/`）
- 関連コード: `site/src/web3/schema.ts`, `site/src/web3/constants.ts`, `site/src/lib/anchoring.ts`, `site/src/web3/projectComments.ts`, `site/src/lib/anchors.ts`

## 1. 背景と問題

現在の EAS コメント schema（`constants.ts:8`）は「ビルド時に前処理済みの、単一の既知ドキュメント（この翻訳ページ）」を前提に最適化されている:

```
string chapter,string blockId,string lang,bytes32 blockHash,uint32 spanStart,uint32 spanEnd,string spanExact,string spanPrefix,string spanSuffix,bytes32 parentUid,string body
```

任意サイトに対してコメントできる Chrome 拡張に一般化する際、次の 3 つの前提が壊れる:

1. **`chapter` / `blockId`** — `blocks:inject` で全ブロックに振った安定 ID が必ず存在する前提（`anchors.ts:19`）。任意サイトの DOM にこの ID は無い。
2. **`blockHash`** — 「ブロック」という単位が定義済みで `normalizeBlockText` で決定論的にハッシュできる前提。生 DOM には「ブロックとは何か」が無い。
3. **ページ識別子（URL）が schema に無い** — ドキュメントが 1 つしかないので不要だった。任意サイト化で最初に必要になる。

一般化の核心は **(A) ターゲット（ページ）の同定** と **(B) DOM 非依存で自己修復するロケータ** の 2 つを足すこと。(B) は既存の `spanExact/Prefix/Suffix`（= W3C TextQuoteSelector）が中核で、ほぼそのまま使える。到達点は W3C Web Annotation Data Model（Hypothes.is が任意サイト注釈をこれで実装）にほぼ一致する。

## 2. 設計判断（decision log）

| # | 論点 | 決定 | 理由 |
|---|---|---|---|
| Q1 | body の保存場所 | **オンチェーン inline（`string body` 継続）** | 検閲耐性最優先。本文も必ずチェーンに残す |
| Q2 | アンカー対象の種類 | **text-only（`span*` の一般化のみ）** | テキストが 9 割、`project()` もテキスト前提。要素/メディアは v2 |
| Q3 | EAS 不変性と将来拡張 | **型付きコア + `string meta`（JSON escape-hatch）** | 再登録なしの前方互換。スキーマ分裂を回避 |
| ロケータ | 任意 DOM の指し方 | **案2: URL + ルートセレクタ + TextQuote 絞り込み** | W3C RangeSelector refinedBy TextQuote。Hypothes.is 実績。堅牢性と軽さの均衡 |

EAS schema は登録後に変更不可（フィールド追加 = 新 UID 登録 = コメントが別スキーマに分裂）。この不変性が Q3 の escape-hatch を価値づける。

## 3. 汎用 EAS schema（本体）

```
string url,string urlCanonical,string origin,string lang,string rootSelector,bytes32 containerHash,uint32 spanStart,uint32 spanEnd,string spanExact,string spanPrefix,string spanSuffix,bytes32 parentUid,string body,string meta
```

| # | フィールド | 型 | 役割 | 由来 |
|---|---|---|---|---|
| 1 | `url` | string | 著者が見た生 URL（provenance / SPA フォールバック） | 🆕 |
| 2 | `urlCanonical` | string | 正規化 URL = ページ同定の join キー | 🆕 |
| 3 | `origin` | string | `scheme://host[:port]` = サイト単位のスコープ/モデレーション/索引 | 🆕 |
| 4 | `lang` | string | ページの言語（`<html lang>`/検出）。表示・フィルタ用 | ♻️ 意味変更（翻訳言語→ページ言語） |
| 5 | `rootSelector` | string | 選択範囲を含む最寄りの安定祖先要素への CSS セレクタ（検索ルート） | 🆕（旧 `blockId` の後継） |
| 6 | `containerHash` | bytes32 | ルート要素の正規化テキストの keccak256 = staleness 判定 | ♻️ 旧 `blockHash`（粒度: ブロック→コンテナ） |
| 7 | `spanStart` | uint32 | 引用の code-point 開始 offset（コンテナ相対） | ♻️ 基準変更 |
| 8 | `spanEnd` | uint32 | 引用の終了 offset（コンテナ相対） | ♻️ 基準変更 |
| 9 | `spanExact` | string | 引用文字列（TextQuote 本体） | ✅ 不変 |
| 10 | `spanPrefix` | string | 前文脈（再マッチの曖昧性解消） | ✅ 不変 |
| 11 | `spanSuffix` | string | 後文脈 | ✅ 不変 |
| 12 | `parentUid` | bytes32 | スレッド親の attestation UID | ✅ 不変 |
| 13 | `body` | string | 本文（オンチェーン inline） | ✅ 不変 |
| 14 | `meta` | string | JSON escape-hatch（通常 `""`） | 🆕 |

設計ポイント:

- `url`/`urlCanonical`/`origin` の 3 層は役割が違う（生 provenance / join キー / サイト索引）。最も削れるのは `url`（生）で、不要なら `meta` に降ろせる。
- **バージョンフィールドは入れない**。EAS では登録される schema UID 自体がバージョン識別子なので冗長。意味変更は新 UID 登録で表現する。
- `author`（=`attester`）/ `createdAt`（=`time`）/ コメント自身の ID（=`uid`）は EAS の attestation 封筒側で既出なので schema に不要（現設計の利点を継承）。

## 4. 現 schema からの移行

| 旧フィールド | 行き先 | 備考 |
|---|---|---|
| `chapter` | ❌ 廃止 | `urlCanonical` が同定を担う |
| `blockId` | → `rootSelector` | inject した ID → CSS セレクタ |
| `blockHash` | → `containerHash` | keccak の役割は同じ、対象がブロック→コンテナ |
| `lang` | → `lang` | 意味のみ変更 |
| `spanStart/End` | → 同名 | 基準がブロック→コンテナ相対 |
| `spanExact/Prefix/Suffix` | → 同名 | 完全不変 |
| `parentUid` / `body` | → 同名 | 完全不変 |
| — | 🆕 `url`/`urlCanonical`/`origin`/`meta` | 新規 |

**現 translation サイトは特殊ケースとして包含される**: ブロックは既に DOM 上に `id` を持つので、汎用 schema では単に `rootSelector = "#<blockId>"`、`urlCanonical = ja ページの URL` と表現するだけ。汎用 schema は現 schema の上位互換であり、翻訳サイト自身も新 schema に素直に移行できる（2 本持つ必要がない）。

## 5. `project()` / `anchoring.ts` への影響 — コア計算は無改造

再アンカリングの心臓部はそのまま生きる:

- `Anchor` インターフェース（`anchoring.ts:6-17`）は構造変化なし。`blockHash` の供給元が `containerHash` に変わるだけで `exact/prefix/suffix/start/end` は同一。
- `project()`（`anchoring.ts:99-137`）の 2 段階ロジック — 未変更なら stored offset を verbatim 返す高速路（`:108-109`）、変化時は exact 再マッチ + 文脈で曖昧性解消（`:112-136`）— 一行も変えずに通用する。

**変わるのは上流の 1 ステップだけ**: 現 `projectComments(blockEl, comments)`（`projectComments.ts:24`）は blockEl が既知（ブロックに id があるから）。汎用版では読み取り時に **まず `rootSelector` を live DOM に当ててコンテナ要素を解決** → その正規化テキストと `containerHash` を計算 → これを `CurrentBlock` に渡す解決ステップが頭に付く。セレクタが何も拾えない場合は **全文 TextQuote 探索にフォールバック**、それも不発なら `orphaned`。

## 6. 拡張機能側で新規に要る実装（schema の外側）

1. **著者時**: 選択範囲から `rootSelector`（安定祖先の CSS セレクタ）を生成するルーチン。`makeAnchor()`（`anchoring.ts:74`）はそのまま、入力テキストがコンテナ正規化テキストになるだけ。
2. **読み取り時**: `rootSelector` 解決 → 失敗時フォールバック → `normalizeBlockText` 相当をコンテナに適用。

新コストは「セレクタ生成（著者）」と「セレクタ解決 + フォールバック（読み取り）」の 2 点に局所化される。projection 資産は無傷。

## 7. `meta`(JSON escape-hatch)の形

通常は `""`。値があるときはオブジェクト。全キー任意、未知キーは無視、不在はデフォルト:

```jsonc
{
  "motivation": "commenting",      // W3C: commenting|highlighting|questioning|describing（既定 commenting)
  "bodyFormat": "text/markdown",   // 既定 text/plain
  "tags": ["typo", "tone"],
  "xpath": "/html/body/main/...",  // CSS rootSelector 失敗時の二次ロケータ（必要時だけ）
  "targetType": "element"          // 将来のマルチターゲット。新 UID なしに Q2 の v2 拡張を実現
}
```

- `targetType` を `meta` に置くことで、画像/要素コメントへの拡張が新 schema UID 登録なしで可能（Q3 escape-hatch の主目的）。
- reactions/いいね は `meta` に入れず、`parentUid` で対象を指す別 attestation にする（可変・集計向き）。

## 8. アプリ層の責務(schema ではなく拡張側の共有ロジック)

### 8.1 `urlCanonical` の正規化規則

同一ページの 2 人の著者が必ず同じ `urlCanonical` を生成しないと join が壊れる → **決定論的・バージョン付きの共有関数**にすること。規則:

- host 小文字化・デフォルトポート除去・末尾スラッシュ正規化
- **トラッキング param 除去は denylist 方式**（`utm_*`/`fbclid`/`gclid`…)。全 param 一律削除は不可（`?id=123` 等は内容を規定する）
- fragment（`#…`)は既定で除去。ただし SPA ハッシュルーティングでは fragment が経路 → サイト別 override、生 `url` を真実として保持
- ページが `<link rel="canonical">` を出していればそれを優先

### 8.2 `containerHash` の「正規化テキスト」定義

- = 解決したコンテナの textContent を、現 `normalizeBlockText` と同一規則（NFC + 空白畳み込み）で正規化したもの。著者側と読み取り側で完全一致必須。それを keccak256。
- 注意: コンテナ内の動的要素（時刻・閲覧数・パーソナライズ)で hash がズレ、誤って "past version" 判定になりうる → 最小の安定コンテナを選ぶ。ただし `containerHash` は高速路の最適化にすぎず、ズレても TextQuote 再マッチが本文位置を回復する安全網がある(正しさは TextQuote が担保）。

## 9. スコープ外 / YAGNI

- マルチターゲット（要素/メディア/動画タイムスタンプ）— v2。`meta.targetType` で新 UID なしに導入可能。
- body のオフチェーン化（`bodyURI` + `bodyHash`）— Q1 でオンチェーン継続を選択したため不採用。
- reactions のための専用フィールド — 別 attestation で表現。
- 明示的 `schemaVersion` フィールド — schema UID がバージョンを担うため不要。

## 10. リスク / 未解決

- **決定論的 canonicalization**: §8.1 の共有関数がクライアント間で一致しないと join が割れる。バージョン管理と十分なテストが要。
- **動的・パーソナライズ DOM**: ログイン状態・A/B・無限スクロールで DOM が変わり offset 系が壊れる → TextQuote 自己修復に重心を置く設計でリスク低減済み。
- **セレクタ生成の品質**: `rootSelector` が脆い（`nth-child` 連鎖など）と陳腐化しやすい。安定祖先選びのヒューリスティクスが実装の肝。
- **任意 DOM 用の正規化テキスト抽出**: `normalizeBlockText` 相当を任意 DOM 向けに再実装する必要があり、移植で最も重い箇所。
