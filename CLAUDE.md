# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shintoku Atlas — an unofficial public information dashboard for Shintoku Town (新得町), Hokkaido. Scrapes municipal data from the official town website and presents it in a searchable, accessible format. AGPL-3.0 licensed.

## Commands

```bash
# Development
npm run dev              # Start Next.js dev server (http://localhost:3000)
npm run build            # Production build (runs build:links then next build)
npm run lint             # ESLint

# Data scraping & sync
npm run sync             # Run all scrapers (announcements → newsletters → index)
npm run scrape:announcements
npm run scrape:newsletters
npm run scrape:giketsu
npm run index:newsletters  # Build full-text search index for newsletters

# Gikai (議会) tools
npm run slides:generate <sessionId> <slideId>  # PDF → slide images (requires poppler)
npm run build:links      # Build gikai_links.json from CSV
npm run suggest:links    # Auto-suggest gikai links
npm run merge:links      # Merge suggested links
```

Scripts are run with `tsx` (TypeScript executor). No test framework is configured.

## Architecture

**Stack**: Next.js 16 (App Router) / React 19 / TypeScript 5 / TailwindCSS 4

**Data flow**: Scrapers (`scripts/`) → JSON files (`public/data/`) → React pages read at build/runtime

There is no database in use. All data lives as JSON files in `public/data/`. Supabase is declared as a dependency but not implemented.

### Key directories

- `app/` — Next.js App Router pages. Main sections: announcements, gikai (議会), newsletters, map, process, insights
- `components/` — Shared React components (Header, Footer, MapView, NewsletterSearch)
- `scripts/` — Data scraping and processing scripts (TypeScript, run via `tsx`)
- `tools/` — Build-time tools for gikai link CSV → JSON conversion
- `lib/scraper/` — Base scraper class and specific scrapers (announcements, newsletters)
- `data/` — Local/working data (scraped HTML, CSVs). Not served publicly
- `public/data/` — Public JSON datasets consumed by the frontend
- `public/pdf/` and `public/slides/` — Gikai session PDFs and generated slide images

### Data pipeline

1. GitHub Actions runs `npm run sync` daily at 12:00 JST and `test-scraper.ts` at 09:00 JST
2. Scrapers fetch from `https://www.shintoku-town.jp/` using Cheerio + Axios
3. Output goes to `public/data/*.json` (announcements, newsletters, newsletters_index, giketsu_index, etc.)
4. Commits are auto-pushed by the workflow

### Styling

Dark theme with custom TailwindCSS 4 theme variables defined in `app/globals.css`. Key utility classes: `.pageWrap`, `.card`, `.btnPrimary`, `.btnSecondary`, `.chip`. Fonts: Noto Sans JP (primary), Inter, IBM Plex Sans.

### Path aliases

`@/*` maps to project root (e.g., `@/components/Header`, `@/lib/scraper/base`)

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## SHINTOKU ATLAS 固有情報

### サイト構成

| パス | ページ名 |
|------|----------|
| / | トップページ |
| /gikai/sessions | 議会を読む（セッション一覧） |
| /gikai/sessions/[id] | 個別セッションページ |
| /gikai | 町の決定を読む（議決一覧） |
| /process | 意思決定の流れを読む（ハブ） |
| /process/issues | 論点カード |
| /process/timeline | 意思決定タイムライン |
| /process/priorities | 重点テーマ |
| /insights | データで見る |
| /map | 地形を読む（実験的） |
| /sources | 出典一覧 |
| /about | About |

### ナビゲーション

- ヘッダー：「議会を読む」「About」の2項目のみ
- フッター：フラット2列
  - 1列目：議会を読む・町の決定を読む・意思決定の流れを読む・地形を読む
  - 2列目：About・Sources・GitHub

### gikai_sessions.json の構造
```json
{
  "id": "r7-2025-12-regular-4",
  "officialTitle": "令和7年定例第4回新得町議会",
  "narrativeTitle": "守りと革新、まちの基盤を固める",
  "date": "2025-12-02",
  "tags": ["定例会", "補正予算", "医療"],
  "summary": {
    "issues": "論点テキスト",
    "conflicts": "争点テキスト",
    "nextActions": "次アクションテキスト"
  },
  "parts": [
    {
      "label": "初日（12/2）",
      "youtube": "https://...",
      "pdf": "r7-2025-12-regular-4_part1.pdf",
      "slidesDir": "part1"
    }
  ]
}
```

### セッションIDの命名規則

`r{元号}-{西暦年}-{月}-{会議種別}`

例：r7-2025-12-regular-4、r8-2026-01-rinji-01

### タグ付けルール

1. 会議種別は必ず1つ付ける
2. テーマは実際に議論された内容に限る（最大5〜6個）
3. 争点あり・修正可決ありは客観的事実として付ける

利用可能なタグ：
- 会議種別：定例会・臨時会・特別委員会・当初予算・補正予算・決算
- テーマ：インフラ・農業・観光・宿泊税・教育・文化・子育て・財政・医療・物価高騰対策・総合計画・エネルギー・人口政策
- 特性：争点あり・修正可決あり

### 論点カード（/process/issues）現在6件

app/process/issues/page.tsx に静的データとして定義：

1. 財政規律 vs 投資・サービス維持（継続中）
2. 地域医療体制の空白（継続中）
3. 宿泊税・観光財源の設計（条例化済み・監視中）
4. ゼロカーボン・エネルギー政策の遅れ（検討中）
5. 農業の持続可能性（検討中）
6. 地域交流センター「とくとく」の役割（検討中）

### デザイン原則

- ダークテーマ
- 静的・抑制的・政治的主張をしない
- 緑リンク（accent色）は乱用しない
- カード全体クリック・CTAは最小限
- ページタイトルは「〜を読む」シリーズで統一
- AIによる要約を含むため誤りがある可能性を明示

### カラー変数（Tailwindカスタム）

| 変数 | 用途 |
|------|------|
| bg-ink | 背景・カード背景 |
| border-line | ボーダー |
| text-textMain | メインテキスト |
| text-textSub | サブテキスト |
| text-accent / bg-accent | 緑のアクセントカラー |

### ロゴ

IBM Plex Sans 300（Light）・全大文字・letter-spacing広め・下線0.5px

### 新規セッション追加の手順

1. PDFを `public/pdf/` にコピー・リネーム（`{sessionId}_part{n}.pdf`）
2. `npm run slides:generate` でスライド画像生成
3. `gikai_sessions.json` に新規セッションを追加
4. タグ付けルールに従ってタグを付与

### 今後の課題

- 既存セッションへのパート追加（令和6年の会議に初日・最終日が未追加）
- モバイル表示の確認・改善
- トップページのモジュールカードがスクロールしないと見えない問題
