# MD正典化：変換スクリプトと往復一致テスト

`docs/content-schema.md` v1.2 に準拠。既存JSONからMDを機械生成し、MD→JSONの正変換で既存データと構造一致することを証明する。

## 事前調査で判明した実データの事実

- [x] `docs/content-schema.md` をリポジトリに配置（ルートから移設・v1.2へ更新）
- [x] `administrative_reports` が `r8-2026-04-rinji-02_day1.json` に実在（型・MD構造ともに追加が必要）
- [x] `topics_index` は3形態が混在 → `_passthrough` 退避で全形態を通す
- [x] `gikai_sessions.json` は厳密な日付降順ではない（`r8-2026-03-yosan-tokubetsu` が `r8-2026-03-regular-1` の前）→ `sortDate` で解決
- [x] UI はどこでも日付ソートせず配列順を表示順に使う（`SessionsList` / `timeline` / `GlobalSearch`）
- [x] タグ規則「種別ちょうど1つ」は18中14セッションが違反 → 会議種別/議案種別/属性/テーマの4分類に再定義（全18通過を確認）
- [x] `speaker_role: "—"` / `speaker_name: "（提案説明のみ）"` / `speaker_role: ""` が実在 → 貪欲マッチで解決
- [x] `gray-matter` 内蔵 js-yaml が `session_date` を `Date` に変換することを実測 → `engines` + js-yaml v5 `CORE_SCHEMA` で解決
- [x] 全 item が規定キーを漏れなく保持 → JSON生成時のデフォルト値埋めが安全

## Phase 1: `scripts/lib/schema.ts`

- [x] 型定義を `app/gikai/sessions/[id]/[partIndex]/page.tsx` から移設（コピーではなく）
- [x] `HonkaigiData.administrative_reports?`, `QnaData.topics_index?: unknown`, `GikaiSession.sortDate?` を追加
- [x] `validateTags()` — 4分類。エラー/警告を分離
- [x] `stableStringify()` — スキーマ §6-6 のキー順・インデント2・末尾改行
- [x] `page.tsx` を `import type { … } from "@/scripts/lib/schema"` に書き換え

## Phase 2: `scripts/json-to-md.ts`（移行用・使い捨て）

- [x] `gikai_sessions.json` → `content/sessions/{id}/session.yaml`
- [x] `sortDate` は date 単独ソートで既存順を再現できないセッションにのみ出力
- [x] `qna/*.json` → `content/sessions/{id}/{day,part,session}{n}.md`
- [x] frontmatter に `extracted_by: migrated-from-json` / `extracted_at` / `reviewed: true`、`part_type` を明示
- [x] 空セクション省略、`topics_index` は `_passthrough` へ退避
- [x] 見出し破壊文字（`topic_title` の ` — ` 等）を警告
- [x] `content/sessions/{id}/transcripts/.gitkeep` を作成

## Phase 3: `scripts/build-data.ts`（恒久）

- [x] `session.yaml` 集約 → `gikai_sessions.json`（`sortDate ?? date` 降順、同値は id 昇順）
- [x] `*.md` パース → `qna/*.json`（`part_type: qna` は出力から省略）
- [x] frontmatter は `gray-matter` + 自前 js-yaml `CORE_SCHEMA`、本文は `remark-parse` AST + 原文スライス
- [x] バリデーション失敗時は `ファイルパス:行番号` 付きで exit 1、JSONは一切出力しない
- [x] 出力は全て `stableStringify`

## Phase 4: `scripts/roundtrip-test.ts`

- [x] 既存JSONをメモリに退避 → 一時ディレクトリでMD生成 → 再変換 → deep equal
- [x] 不一致は `セッションID / ファイル / JSONパス / expected / actual` を全件列挙
- [x] **受け入れ基準: 全18セッション・全7パートファイル green**

## 統合（green 後のみ）

- [x] `package.json` に `build:data` / `test:roundtrip`、`build` を差し替え
- [x] `content/` をコミット（この瞬間からMDが正典）
- [x] `CLAUDE.md`: `public/data/` 直接編集禁止の明記 + Data Creation Workflow 書き換え + タグ規則を §10 に合わせる
- [x] `npm run build` が通ることを確認

## Review

**結果: 往復テストは全18セッション・7パートファイルで green。** 既存JSONと再生成JSONの総フィールド数も1266で一致。
`npm run build` は45パート全てのSSGを生成して成功し、`/gikai/sessions` の表示順も変わっていない。

### 指示書から変更した点（実データが仕様と食い違っていたため）

| 箇所 | 指示書 | 実際 | 対応 |
|---|---|---|---|
| タグ規則 | 種別タグちょうど1つ | 18中14セッションが違反（会議種別と議案種別が併用） | 4分類に再定義。全18通過 |
| 並び順 | 日付降順に正規化 | 既存JSONは1箇所だけ逆転しており、UIは配列順を表示順に使う | `sortDate` を追加し既存順を保存 |
| `build` script | `build:data && next build` | `build:links` が `gikai_links.json` を生成している | `build:links && build:data && next build` |
| `HonkaigiData` | `administrative_reports` 未記載 | `r8-2026-04-rinji-02_day1.json` に実在 | 型・MD構造（`# 行政報告`）に追加 |
| gray-matter | `JSON_SCHEMA` でパース | js-yaml v5 では `CORE_SCHEMA` | `CORE_SCHEMA` を使用。防御が効くことを実測で確認 |

### 設計判断

- **本文テキストは `position.offset` による原文スライスで取り出す。** `mdast-util-to-string` 相当を使うと `**質問者**` の `**` や URL の `_` が失われる。正規表現はメタ行（`tags:` `Q:` `A:` `note:` 等）に限定した
- **`speaker_role` が空でも `（）` を書く。** 省略すると名前とタイトルの境界が消える。見出しは name を貪欲に取るため `## （提案説明のみ）（—）— …` のような実データも壊れない
- **MDは空セクションを省略し、JSONは全フィールドをデフォルト値で埋める。** UIが `.map()` で回すため `undefined` を出せない
- **`json-to-md.ts` は既存JSONから読む＝往復テストは比較の両辺が同じ入力に由来する。** したがって既存JSONを改変してもテストは落ちない（両辺が同時に動くため）。断層はMD側に注入して検証した

### 断層注入で確認した検出能力

不一致として検出: 行政報告の削除 / `note:` 行の削除 / 答弁の1文字改変 / `topics_index` の欠落
バリデーションで停止: 見出しの ` — ` 消失 / `Q:` の崩れ / boolean の日本語化 / 空役割 `（）` の省略

### 残課題（スコープ外・別タスク）

- `scripts/addSession.mjs` は `public/data/gikai_sessions.json` を直接書き換えるため、現状では使えない（`build:data` に上書きされる）。`session.yaml` を作る方式へ要書き換え
- `topics_index` の3スキーマ正規化（現在は `_passthrough` に退避しているだけ）
- 字幕からの再抽出、RSS監視・GitHub Actions パイプライン
