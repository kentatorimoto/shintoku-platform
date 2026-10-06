# Shintoku Atlas

**新得町議会を読むための、非公式の記録集**

**Live Demo: https://shintoku-platform.vercel.app**

![License](https://img.shields.io/badge/license-AGPL--3.0-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🎯 何を作ったか

北海道新得町の議会の動画・資料・議決を構造化し、「誰が何を問い、何が決まり、何が続いているか」を読めるようにした非公式の記録集です。

議会の記録は公開されていますが、数時間の動画と PDF のままでは、あとから辿るのが難しい。Shintoku Atlas は会議ごとに、議員の質問と町の答え、議案の採決結果、次に持ち越された課題を整理して並べます。

個人による取り組みで、新得町役場とは無関係です。使うのは公開情報だけで、役場や町民に追加の作業は生じません。政党にも企業にもよりません。

## 📊 規模

| | |
|---|---|
| 会議 | 21 |
| 議決 | 729 |
| 継続論点 | 6 |

## 🤖 AI の使い方

```
YouTube 字幕 → Claude による構造化抽出 → 人間のレビュー → Markdown で正典化 → JSON → Web
```

- **字幕は加工しない**: 取得した字幕は `content/sessions/{id}/transcripts/` にそのまま残します
- **Claude が構造化する**: 字幕から、一般質問（質問・答弁・継続課題）と議案審議（議案・質疑・採決結果）を Markdown に抽出します。検証に通らなければ自己修正します（最大2回）
- **人間がレビューする**: 固有名詞・数値・タグを人が確かめ、`reviewed: true` にしてからマージします
- **Markdown が正典**: `content/sessions/**` が正で、`public/data/` の JSON は `npm run build:data` の生成物です

新着動画の検知から PR 作成までは GitHub Actions で自動化しています。毎日 09:00 JST に議会チャンネルの RSS を見て、新着があれば Issue を立て、字幕取得・抽出・検証を経て PR を作ります。人が行うのは PR のレビューとマージです。

AI による要約には誤りが含まれる可能性があります。各会議のページから元の動画と資料を確認できます。

## 🛠️ 技術スタック

| 層 | 技術 |
|---|---|
| フレームワーク | Next.js 16.1（App Router） |
| UI | React 19.2, TypeScript 5 |
| スタイリング | TailwindCSS 4 |
| AI 抽出 | Claude（@anthropic-ai/sdk 0.110）, youtube-transcript 1.3 |
| 正典の処理 | gray-matter 4, js-yaml 5, remark 15 |
| データ収集 | Cheerio 1.2, Axios 1.13 |
| PDF | pdf-parse 2.4, poppler（スライド画像） |
| 地図 | Leaflet 1.9 |
| データベース | なし（`public/data/` の静的 JSON） |
| CI/CD | GitHub Actions |
| デプロイ | Vercel |

## 📦 インストール
```bash
# リポジトリをクローン
git clone https://github.com/kentatorimoto/shintoku-platform.git
cd shintoku-platform

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

http://localhost:3000 を開く

## 🔧 データ収集
```bash
# 新得町のお知らせをスクレイピング
npx tsx scripts/test-scraper.ts
```

データは `data/scraped/` に保存されます

## 🎥 会議アーカイブ（スライド画像生成）

議会の会議動画・NotebookLM スライドを `/gikai/sessions` ページで閲覧できます。

### 前提

**poppler** が必要です（macOS）:
```bash
brew install poppler
```

### PDF の配置

NotebookLM スライドの PDF を以下の命名規則で配置してください:

```
public/pdf/<sessionId>_<slideId>.pdf
```

例:
```
public/pdf/r8-2026-01-20-basic-plan_morning.pdf
public/pdf/r8-2026-01-20-basic-plan_afternoon.pdf
```

### スライド画像の生成

```bash
npm run slides:generate <sessionId> <slideId>
```

例:
```bash
npm run slides:generate r8-2026-01-20-basic-plan morning
npm run slides:generate r8-2026-01-20-basic-plan afternoon
```

生成先: `public/slides/<sessionId>/<slideId>/page-001.jpg` 〜

- 先頭 20 ページまで生成（150dpi JPEG）
- `page-001.jpg` が存在する場合はスキップ（再生成は出力ディレクトリを削除して再実行）

### 会議データの追加

会議データの正典は `content/sessions/{sessionId}/` の Markdown と `session.yaml` です。`public/data/gikai_sessions.json`・`public/data/qna/`・`public/data/cards/` は `npm run build:data` の生成物なので、直接編集しません。

```
字幕（transcripts/） →  Markdown（content/sessions/） →  JSON（public/data/）
   加工しない              正典・人がレビューする           生成物・直接編集しない
```

**通常は自動で入ります。** 議会チャンネルに新着動画があると、GitHub Actions が Issue を立て、字幕の取得から PR の作成までを行います。人が行うのは PR のレビューです。固有名詞・数値・タグを確かめ、各 Markdown を `reviewed: true` にしてマージします。

**手動で取り込む場合**（自動が止まったとき）:

```bash
npm run add-session -- \
  --id r8-2026-06-regular-2 \
  --url "https://www.youtube.com/watch?v=XXXX" \
  --type honkaigi --part day2 --label "最終日（6/19）" \
  --date 2026-06-19 \
  --title-official "令和8年定例第2回新得町議会" \
  --tags "定例会,補正予算,観光"
```

抽出には Claude API のキー（`ANTHROPIC_API_KEY`）が必要です。

**内容を直す場合**は `content/sessions/{sessionId}/` の Markdown を編集し、JSON を作り直します:

```bash
npm run build:data   # content/sessions/** → public/data/*.json（検証に落ちると exit 1）
```

スキーマは [docs/content-schema.md](docs/content-schema.md)、自動取り込みの運用は [docs/auto-ingest.md](docs/auto-ingest.md) にあります。

## 📁 プロジェクト構成
```
shintoku-platform/
├── app/                        # Next.js App Router
│   ├── page.tsx                # トップページ
│   ├── gikai/                  # 町の決定を読む（議決一覧）
│   │   └── sessions/           # 議会を読む（会議一覧・会議ごとのページ）
│   ├── process/                # 意思決定の流れ（論点カード・タイムライン・重点テーマ）
│   ├── insights/               # データで見る
│   ├── shiseki/                # 史跡の資料
│   ├── sources/                # 出典一覧
│   └── about/
├── components/                 # 共通コンポーネント（ヘッダー・横断検索・要点カードなど）
├── content/                    # 正典（Markdown + YAML）
│   ├── sessions/{sessionId}/   # 会議ごとの記録
│   │   ├── session.yaml        #   会議のメタ情報
│   │   ├── day{n}.md           #   本会議（議案審議）
│   │   ├── part{n}.md          #   パート別の記録（一般質問など）
│   │   ├── cards.yaml          #   要点カード
│   │   └── transcripts/        #   字幕の生データ（加工しない）
│   └── archive/                # 史跡・郷土資料
├── scripts/                    # 取り込み・抽出・ビルド・スクレイピング（tsx で実行）
│   ├── lib/                    #   共通の型・検証・セッションIDの対応表
│   └── prompts/                #   Claude に渡す抽出プロンプト
├── lib/                        # UI ラベル・OGP・スクレイパー
├── tools/                      # 議会と議決のリンク生成
├── data/                       # 作業用データ（配信しない。スクレイピング結果など）
├── public/
│   ├── data/                   # 配信する JSON（会議・議決・検索索引。一部は生成物）
│   ├── pdf/                    # 会議スライドの PDF
│   └── slides/                 # スライド画像
├── docs/                       # スキーマ・自動取り込みの運用・デザインの指針
└── .github/workflows/          # 新着検知・自動取り込み・定期同期
```

## 🌐 データソース

- [新得町公式サイト](https://www.shintoku-town.jp/)
- [新得町お知らせページ](https://www.shintoku-town.jp/oshirase/)

## 📝 ライセンス

AGPL-3.0-or-later

このプロジェクトは完全オープンソースです。コードの改変・再配布は自由ですが、改変版も同じライセンスで公開する必要があります。

## 🤝 コントリビューション

プルリクエスト、イシューの作成を歓迎します！

## 📞 お問い合わせ

このプロジェクトは個人による実験的な取り組みです。
新得町役場とは無関係です。

---

Made with ❤️ for 新得町

