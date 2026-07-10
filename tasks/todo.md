# 字幕→MD抽出パイプライン（addSession置き換え＋自動監視）

前提の PR #1（MD正典化）はマージ済み。`docs/content-schema.md` は v1.2。

## Phase 0: 事前整備

- [x] 依存: `@anthropic-ai/sdk` `youtube-transcript`
- [x] `.env.local` に `ANTHROPIC_API_KEY`（`.gitignore` の `.env*` に含まれることを確認済み）
- [x] `daily-sync.yml` の `git add public/data/*.json` を明示パスに限定
- [x] 0バイトファイル `を` を削除
- [x] `json-to-md.ts` / `roundtrip-test.ts` を `scripts/migration/` へ凍結（README.md 添付、`test:roundtrip` を npm scripts から削除）

## Phase 1: `scripts/fetch-transcript.ts`

- [x] `/live/` を含むURL形式から動画IDを自前抽出
- [x] タイムスタンプ付きプレーンテキスト + `# source:` `# fetched:` メタ行
- [x] exit規約: 0 成功 / 1 エラー / 2 字幕未生成 / 3 字幕が恒久的に無効
- [x] `--force` 無しは冪等

## Phase 2: `scripts/extract-md.ts`

- [x] `scripts/prompts/glossary.md`（議員名簿 + 誤認識パターン）
- [x] `scripts/prompts/extract-{qna,honkaigi}.md`（`docs/content-schema.md` の該当節を実行時に埋め込む）
- [x] モデルは `scripts/config.ts` で一元管理
- [x] 自己修正ループ（`build-data` のバリデータ → エラーメッセージをAPIに返す、最大2回）
- [x] 入出力トークン数と概算コストをログに出す
- [x] `【要確認: 〜】` マーク
- [x] system プロンプトにプロンプトキャッシュ

## Phase 3: `scripts/add-session.ts`

- [x] `session.yaml` の scaffold / parts 追記
- [x] narrativeTitle をAIに3案出させ、コメントで残して第1案を仮置き
- [x] Phase 1 → Phase 2 → `npm run build`
- [x] `feat/session-{id}` ブランチ + `gh pr create`（`--no-pr` でスキップ）
- [x] `addSession.mjs` を削除、`CLAUDE.md` を新フローに書き換え

## Phase 4: `.github/workflows/watch-council.yml`

- [x] cron 09:00 JST、`scripts/watch-council.ts`
- [x] RSS（`channel_id=UC8YKJ8zgl7CoGL0kapCPMzg`）→ 新着なら Issue
- [x] 既知リストは `data/watch/known-videos.json`（`daily-sync` のグロブ対象外）
- [x] `git add` は明示パス指定

## 受け入れ基準

- [x] 1. 実セッションを `add-session` だけで通せる（`r8-2026-06-regular-2` の初日・最終日）
- [x] 2. 生成MDが `build:data` を無修正で通過（初日は自己修正0回）
- [x] 3. `【要確認】` マークがPR本文に集約される
- [x] 4. watcher が known-videos.json 削除 → 再実行で Issue を作れる

## Review

（実装後に記入）
