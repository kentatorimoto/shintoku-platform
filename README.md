# Shintoku Atlas

**An unofficial public information dashboard**

新得町の公開情報を検索しやすく、APIとして利用可能にする完全オープンソースのプラットフォーム

![License](https://img.shields.io/badge/license-AGPL--3.0-green)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🎯 プロジェクトの目的

- 🏛️ **町の公開情報を自動収集**: 新得町公式サイトから最新情報を自動取得
- 🔍 **全文検索機能**: お知らせを簡単に検索
- 📊 **データAPI提供**: 機械可読形式でデータを提供
- 📱 **レスポンシブデザイン**: スマホでも見やすいUI
- ⚖️ **完全オープンソース**: AGPL-3.0ライセンス

## ✨ 特徴

### 非党派性・非企業性
政党にも企業にもよらない、中立的な町政情報基盤

### 役場・町民への負担ゼロ
新得町公式サイトの公開情報のみを使用。役場や町民への追加作業は一切不要

### オープンソース
全コードを公開。誰でも改善・拡張が可能

## 🚀 現在の機能

- ✅ **町政ニュース**: 新得町の最新お知らせを自動収集（20件）
- 🚧 **広報しんとくアーカイブ**: 開発中
- 🚧 **イベントカレンダー**: 開発中
- 🚧 **議会情報**: 開発中

## 🛠️ 技術スタック

- **フロントエンド**: Next.js 15, React, TypeScript
- **スタイリング**: TailwindCSS
- **データ収集**: Cheerio, Axios
- **データベース**: Supabase（予定）
- **デプロイ**: Vercel（予定）

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

`public/data/gikai_sessions.json` に会議を追加してください:

```json
{
  "id": "<sessionId>",
  "title": "会議タイトル",
  "date": "YYYY-MM-DD",
  "videos": [
    { "label": "午前", "youtubeUrl": "https://www.youtube.com/watch?v=..." }
  ],
  "slides": [
    { "id": "morning", "label": "午前スライド", "pdfFile": "<sessionId>_morning.pdf" }
  ]
}
```

## 📁 プロジェクト構成
```
shintoku-platform/
├── app/                    # Next.js App Router
│   ├── page.tsx           # トップページ
│   └── announcements/     # お知らせ一覧
├── lib/
│   └── scraper/           # スクレイピング機能
├── scripts/               # 実行スクリプト
├── data/
│   └── scraped/           # 収集データ
└── components/            # 共通コンポーネント
```

## 🌐 データソース

- [新得町公式サイト](https://www.shintoku-town.jp/)
- [新得町お知らせページ](https://www.shintoku-town.jp/oshirase/)

## 📝 ライセンス

AGPL-3.0-or-later

このプロジェクトは完全オープンソースです。コードの改変・再配布は自由ですが、改変版も同じライセンスで公開する必要があります。

## 🤝 コントリビューション

プルリクエスト、イシューの作成を歓迎します！

## 💡 将来の展望

- [ ] 広報しんとくPDFの全文検索
- [ ] イベント情報の統合
- [ ] 町議会の議事録データベース
- [ ] 町予算の可視化
- [ ] AIによる情報要約
- [ ] APIの公開

## 📞 お問い合わせ

このプロジェクトは個人による実験的な取り組みです。
新得町役場とは無関係です。

---

Made with ❤️ for 新得町

