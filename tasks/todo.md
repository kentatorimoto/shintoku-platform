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

- [ ] 型定義を `app/gikai/sessions/[id]/[partIndex]/page.tsx` から移設（コピーではなく）
- [ ] `HonkaigiData.administrative_reports?`, `QnaData.topics_index?: unknown`, `GikaiSession.sortDate?` を追加
- [ ] `validateTags()` — 4分類。エラー/警告を分離
- [ ] `stableStringify()` — スキーマ §6-6 のキー順・インデント2・末尾改行
- [ ] `page.tsx` を `import type { … } from "@/scripts/lib/schema"` に書き換え

## Phase 2: `scripts/json-to-md.ts`（移行用・使い捨て）

- [ ] `gikai_sessions.json` → `content/sessions/{id}/session.yaml`
- [ ] `sortDate` は date 単独ソートで既存順を再現できないセッションにのみ出力
- [ ] `qna/*.json` → `content/sessions/{id}/{day,part,session}{n}.md`
- [ ] frontmatter に `extracted_by: migrated-from-json` / `extracted_at` / `reviewed: true`、`part_type` を明示
- [ ] 空セクション省略、`topics_index` は `_passthrough` へ退避
- [ ] 見出し破壊文字（`topic_title` の ` — ` 等）を警告
- [ ] `content/sessions/{id}/transcripts/.gitkeep` を作成

## Phase 3: `scripts/build-data.ts`（恒久）

- [ ] `session.yaml` 集約 → `gikai_sessions.json`（`sortDate ?? date` 降順、同値は id 昇順）
- [ ] `*.md` パース → `qna/*.json`（`part_type: qna` は出力から省略）
- [ ] frontmatter は `gray-matter` + 自前 js-yaml `CORE_SCHEMA`、本文は `remark-parse` AST + 原文スライス
- [ ] バリデーション失敗時は `ファイルパス:行番号` 付きで exit 1、JSONは一切出力しない
- [ ] 出力は全て `stableStringify`

## Phase 4: `scripts/roundtrip-test.ts`

- [ ] 既存JSONをメモリに退避 → 一時ディレクトリでMD生成 → 再変換 → deep equal
- [ ] 不一致は `セッションID / ファイル / JSONパス / expected / actual` を全件列挙
- [ ] **受け入れ基準: 全18セッション・全7パートファイル green**

## 統合（green 後のみ）

- [ ] `package.json` に `build:data` / `test:roundtrip`、`build` を差し替え
- [ ] `content/` をコミット（この瞬間からMDが正典）
- [ ] `CLAUDE.md`: `public/data/` 直接編集禁止の明記 + Data Creation Workflow 書き換え + タグ規則を §10 に合わせる
- [ ] `npm run build` が通ることを確認

## Review

（実装後に記入）
