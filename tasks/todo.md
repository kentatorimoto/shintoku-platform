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

**実セッション2本を字幕から抽出し、どちらも自己修正0回で `build:data` を通過。** `npm run build` は9パートファイル・80ページのSSGを生成して成功。

| セッション | 字幕 | 議案 | 自己修正 | 時間 | コスト |
|---|---|---|---|---|---|
| `r8-2026-06-regular-2` 初日 | 69分 / 15,670字 | 36 | 0回 | 7分35秒 | $0.509 |
| `r8-2026-06-regular-2` 最終日 | 33分 / 7,371字 | 14 | 0回 | 約4分 | $0.204 |

### 指示書から変更した点

| 箇所 | 指示書 | 実際 | 対応 |
|---|---|---|---|
| exit 2/3 の判定 | `fetch-transcript` が字幕の有無で判定 | `youtube-transcript` は「投稿者が無効化」「未生成」「動画が非公開」を全部 `DisabledError` に潰す | watchページを自前で検分。`playabilityStatus` と公開日時で分類 |
| 動画が非公開 | 規定なし | 26本中15本が該当 | exit 1（人間の対処が要る。字幕の問題ではない） |
| `MAX_TOKENS` | 規定なし | 32000 では69分の本会議で足りない | 64000。adaptive thinking の思考トークンが出力枠を消費する |
| `EFFORT` | 規定なし | `high` は1リクエスト9分近く | `medium` |
| frontmatter | AIがMD全体を書く | 日付・`part_index`・`_passthrough` を触らせたくない | スクリプトが決定的に生成し、AIは本文だけ書く |
| 字幕15万字の分割 | 超えたら対応 | 実データの最長は32,015字（115分） | 未実装。超えたらエラーで止める |

### 設計判断

- **`youtube-transcript` のエラークラスを exit code の判定に使わない。** `captionTracks` が空なだけで `YoutubeTranscriptDisabledError` を投げるので、「字幕が無効」「まだ生成されていない」「動画が非公開」の3つが区別できない。watchページを1回取って `playabilityStatus` / `captionTracks` / `publishDate` を見て分類する
- **プロンプトは `docs/content-schema.md` の §3+§4（qna）/ §3+§5（honkaigi）を実行時に読み込んで埋め込む。** スキーマを直せばプロンプトも自動で追随する
- **`【要確認: 聞こえたまま】` は創作を防ぐだけでなく、レビューの起点になる。** 初日28件・最終日5件。「新徳」が本文に残るのはマーク内だけで、glossary の規則どおり
- **system プロンプト（スキーマ+glossary、約8kトークン）にプロンプトキャッシュ。** 自己修正ラウンドと連続実行で効く

### glossary が実際に効いた例

字幕は最終日の質問者を「福原**友行**議員」と誤認識していたが、名簿の正式表記「福原 智幸」に修正された。既存 `content/` に残る「福原 **之行**」も同じ誤認識の未修正版だと判明した。

### 判明した問題（このPRのスコープ外）

- **既存26パート中15本の YouTube 動画が非公開化されている**（`playabilityStatus: LOGIN_REQUIRED`、oEmbed 403）。R6全部とR7初期。サイト上のリンクが死んでおり、字幕からの再抽出もできない
- 既存 `content/` の議員名に誤りが4件（`桜田`→`櫻田`、`斎藤`→`齊藤`、`福原 之行`→`福原 智幸`、`松山委員` は名簿に該当者なし）
- `topics_index` の3スキーマ正規化は未着手（`_passthrough` に退避したまま）

### 未検証

- `add-session` の PR 作成パス（`--no-pr` で回避した。ブランチを切ってPRを出す部分だけコード上の実装のみ）
- `watch-council.yml` の GitHub Actions 上での実行（ローカルで `--dry-run` と Issue 作成の判定は検証済み）
