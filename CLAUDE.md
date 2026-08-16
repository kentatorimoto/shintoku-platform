# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Shintoku Atlas** — an unofficial public information dashboard for Shintoku Town (新得町), Hokkaido, Japan. Scrapes municipal data from the official town website and presents it in a searchable, accessible format. Licensed under AGPL-3.0.

Key features:
- Gikai (議会) session viewer with PDF slides, YouTube links, AI-generated summaries, Q&A (一般質問), and honkaigi (本会議議案) structured data
- Full-text search for newsletters (町報) and decisions (議決)
- Decision-making process visualization (timeline, issue cards, priorities)
- Interactive map with GeoJSON overlays (rivers, passes, center shifts)
- Automated daily scraping via GitHub Actions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TypeScript 5 (strict mode) |
| Styling | TailwindCSS 4 with custom dark theme |
| Scraping | Cheerio + Axios |
| Maps | Leaflet |
| Icons | lucide-react |
| Date handling | date-fns |
| PDF processing | pdf-parse, poppler (slides) |
| CI/CD | GitHub Actions (daily sync at 12:00 JST, test scrape at 09:00 JST) |
| Database | None — all data is static JSON in `public/data/` |
| Package manager | npm (Node 20) |

## Directory Structure

```
shintoku-platform/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (fonts, GA, metadata)
│   ├── globals.css               # TailwindCSS 4 theme & utility classes
│   ├── page.tsx                  # Home page
│   ├── about/                    # About page
│   ├── announcements/            # Town announcements
│   ├── gikai/                    # 議会 (Assembly)
│   │   ├── page.tsx              #   議決一覧 (decisions list)
│   │   ├── layout.tsx            #   Shared gikai layout
│   │   └── sessions/
│   │       ├── page.tsx          #   Session list
│   │       ├── SessionsList.tsx  #   Client component
│   │       └── [id]/             #   Dynamic session detail
│   │           ├── SessionDetail.tsx  # Client component (tabs, video, honkaigi, QNA, slides)
│   │           └── [partIndex]/       # Part-specific page (SSG, getPartData)
│   ├── insights/                 # Data visualizations
│   ├── map/                      # Interactive map (experimental)
│   ├── newsletters/              # Newsletter search
│   ├── process/                  # Decision-making process
│   │   ├── issues/               #   Issue cards + tuktuk subpage
│   │   ├── timeline/             #   Timeline view
│   │   └── priorities/           #   Priority themes
│   └── sources/                  # Source attribution
├── components/                   # Shared React components
│   ├── Header.tsx                # Navigation header
│   ├── Footer.tsx                # Footer with links
│   ├── MapView.tsx               # Leaflet map wrapper (~34KB)
│   ├── NewsletterSearch.tsx      # Full-text search UI
│   └── GiketsuCountBadge.tsx     # Decision count badge
├── lib/
│   └── scraper/                  # Scraper classes
│       ├── base.ts               #   Abstract BaseScraper (Axios + Cheerio)
│       ├── announcements.ts      #   Announcements scraper
│       └── newsletters.ts        #   Newsletters scraper
├── content/                      # ★ 議会セッションの正典（MD + YAML）
│   └── sessions/{sessionId}/
│       ├── session.yaml          #   セッションメタ
│       ├── day{n}.md             #   本会議（part_type: honkaigi）
│       ├── part{n}.md            #   パート別（part_type: qna）
│       ├── session.md            #   単一パート（part_type: qna）
│       ├── cards.yaml            #   要点カード（MDの派生物。cards:generate で生成）
│       └── transcripts/          #   Layer 0: 字幕生データ（不可侵）
├── docs/
│   └── content-schema.md         # コンテンツ正典スキーマ（迷ったらこれが正）
├── scripts/                      # Data scripts (run via tsx)
│   ├── config.ts                 # ★ モデル名・閾値・exit code 規約の一元管理
│   ├── lib/schema.ts             # ★ 共通型・validateTags・stableStringify
│   ├── build-data.ts             # ★ content/ → public/data/（恒久ビルド）
│   ├── add-session.ts            # ★ 字幕→MD→PR のオーケストレータ
│   ├── fetch-transcript.ts       #   YouTube字幕 → transcripts/（Layer 0）
│   ├── extract-md.ts             #   字幕 → MD（Claude API + 自己修正ループ）
│   ├── generate-cards.ts         #   レビュー済みMD → cards.yaml（要点カード）
│   ├── watch-council.ts          #   RSS監視 → GitHub Issue
│   ├── prompts/                  #   抽出プロンプト（git履歴で改善を追える）
│   │   ├── glossary.md           #     固有名詞対訳表（議員名簿・誤認識パターン）
│   │   ├── extract-qna.md
│   │   ├── extract-honkaigi.md
│   │   └── cards.md              #     要点カードの抽出プロンプト
│   ├── migration/                #   凍結。移行時の証明ツール（README.md 参照）
│   ├── sync-all.ts               # Master sync orchestrator
│   ├── scrape-announcements.ts
│   ├── scrape-newsletters.ts
│   ├── scrape-giketsu.ts
│   ├── index-newsletters.ts      # Full-text index builder
│   ├── convertSlides.mjs         # PDF → JPEG slides (requires poppler)
│   ├── test-scraper.ts           # CI test scraper
│   └── lib/http.ts               # HTTP utilities
├── tools/                        # Build-time tools
│   ├── build-gikai-links.mjs     # CSV → JSON conversion
│   ├── suggest-gikai-links.mjs   # Auto-suggest links
│   └── merge-gikai-links.mjs     # Merge suggested links
├── data/                         # Local working data (not served)
│   ├── scraped/                  # Raw scraped snapshots
│   ├── gikai_links.csv           # Source CSV for links
│   └── process.json              # Process data
├── public/
│   ├── data/                     # Public JSON datasets (served) ※gikai_sessions.json と qna/ は生成物
│   │   ├── gikai_sessions.json   # Core session metadata
│   │   ├── gikai_links.json      # Session-to-decision links
│   │   ├── giketsu_index.json    # Decisions full-text index
│   │   ├── newsletters_index.json # Newsletter search index (~3MB)
│   │   ├── decision_links.json
│   │   ├── basin_questions.json
│   │   ├── lastSync.json
│   │   ├── qna/                  # Session part data (QNA / honkaigi)
│   │   ├── cards/                # 要点カード（cards.yaml の生成物）
│   │   └── *.geojson             # Map layers
│   ├── pdf/                      # Gikai session PDFs
│   └── slides/                   # Generated slide images
├── tasks/                        # Task tracking files
├── .github/workflows/            # CI/CD
│   ├── daily-sync.yml            # npm run sync at 12:00 JST
│   ├── daily-scrape.yml          # test-scraper at 09:00 JST
│   └── watch-council.yml         # 新着動画の検知 → Issue at 09:00 JST
├── next.config.ts                # Minimal (no custom config)
├── tsconfig.json                 # strict: true, @/* path alias
├── eslint.config.mjs             # next/core-web-vitals + typescript
└── postcss.config.mjs            # @tailwindcss/postcss
```

## Commands

```bash
# Development
npm run dev              # Start Next.js dev server (http://localhost:3000)
npm run build            # Production build (build:links -> build:data -> next build)
npm run lint             # ESLint

# Content (MD is canonical)
npm run build:data       # content/sessions/** -> public/data/*.json (validates, exits 1 on error)

# Session pipeline (字幕 -> MD -> PR)
npm run add-session -- --id <id> --url <url> --type qna|honkaigi --part day1 --label "..." --date YYYY-MM-DD
npm run fetch:transcript -- --url <url> --out <path>
npm run extract:md -- --session <id> --part day1 --type honkaigi
npm run cards:generate -- <sessionId>  # レビュー済みMD -> cards.yaml（全パート reviewed:true が前提）
npm run watch:council -- [--dry-run]   # RSS監視 -> GitHub Issue

# Data scraping & sync
npm run sync             # Run all scrapers (announcements -> newsletters -> index)
npm run scrape:announcements
npm run scrape:newsletters
npm run scrape:giketsu
npm run index:newsletters  # Build full-text search index for newsletters

# Gikai tools
npm run slides:generate <sessionId> <slideId>  # PDF -> slide images (requires poppler)
npm run build:links      # Build gikai_links.json from CSV
npm run suggest:links    # Auto-suggest gikai links
npm run merge:links      # Merge suggested links
```

Scripts are run with `tsx` (TypeScript executor). No test framework is configured.

## Data Flow

スクレイピング系（町報・議決・お知らせ）と、議会セッション系（MD正典）の2系統がある。

```
Official town website (shintoku-town.jp)      YouTube 字幕
  ↓  Cheerio + Axios (scripts/)                 ↓  Layer 0（不可侵）
Local scraped data (data/scraped/)            content/sessions/{id}/transcripts/
  ↓  Processing & indexing                      ↓  AI抽出 + 人間レビュー
Public JSON (public/data/*.json)  ←────────  content/sessions/{id}/*.md, session.yaml（正典）
  ↓  fetch() at build/runtime          build:data
Next.js App Router pages (app/)
```

`public/data/gikai_sessions.json`・`public/data/qna/*.json`・`public/data/cards/*.json` は
`npm run build:data` の生成物。**直接編集禁止** — 修正は `content/` のMD / cards.yaml に対して行う。

GitHub Actions automates:
- `daily-sync.yml`: Runs `npm run sync` + `index:newsletters` at 12:00 JST, commits `lastSync.json` / `newsletters_index.json` （生成物 `gikai_sessions.json` / `qna/` には触れない）
- `daily-scrape.yml`: Runs `test-scraper.ts` at 09:00 JST, commits `data/scraped/` changes
- `watch-council.yml`: Runs `watch-council.ts` at 09:00 JST。議会チャンネルのRSSに新着があれば GitHub Issue を立て、`data/watch/known-videos.json` を更新する

## Coding Conventions

### TypeScript

- **Strict mode** enabled (`"strict": true` in tsconfig)
- **`interface`** for object shapes and component props; **`type`** for unions and complex types
- Path alias: `@/*` maps to project root (e.g., `@/components/Header`)
- Full type annotations on function parameters; generics used freely (`Record<string, ...>`)

### Components

- **Function declarations** with `export default`: `export default function Header() { ... }`
- **`"use client"`** directive at the top of client components (Header, MapView, NewsletterSearch, etc.)
- **Props** defined as `interface Props { ... }` with inline destructuring: `function Foo({ bar }: Props)`
- Hooks: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef` — no external state management
- No Prettier or EditorConfig — relies on ESLint (`next/core-web-vitals` + `next/typescript`)

### Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `SessionsList.tsx`, `MapView.tsx` |
| Utility/script files | kebab-case | `scrape-announcements.ts`, `sync-all.ts` |
| Variables & functions | camelCase | `selectedTags`, `parseJapaneseDate()` |
| Constants | UPPER_SNAKE_CASE | `NAV_LINKS`, `RELIEF_OPACITY_DEFAULT` |
| Types/Interfaces | PascalCase | `GikaiSession`, `LayerStatus` |

### Imports

- Ordered: React/external libraries -> Next.js -> project imports (`@/...`)
- Destructured imports for hooks: `import { useState, useEffect } from "react"`
- Inline type imports: `import { useState, type ReactNode } from "react"`
- Double quotes for strings

### Styling

- **Dark theme** with custom TailwindCSS 4 variables in `app/globals.css`
- Custom utility classes: `.pageWrap`, `.card`, `.btnPrimary`, `.btnSecondary`, `.chip`, `.input`
- Responsive modifiers: `md:`, `sm:`, `lg:`
- Opacity shorthand: `bg-accent/20`, `text-textSub/60`
- No CSS modules — all Tailwind inline classes + custom `@apply` utilities

**Color variables:**

| Variable | Usage |
|----------|-------|
| `base` (#0B0F14) | Page background |
| `ink` (#0E141B) | Card background |
| `line` (#1F2A36) | Borders |
| `accent` (#2BD1A3) | Green accent (links, buttons) |
| `accentSoft` (#1AA37E) | Softer green (hover states) |
| `textMain` (#E6EEF7) | Primary text |
| `textSub` (#8FA3B8) | Secondary text |

### Scripts

- Async `main()` pattern with `.catch()` at bottom:
  ```typescript
  async function main() { ... }
  main().catch((err) => { console.error("Failed:", err); process.exit(1) })
  ```
- `BaseScraper` class in `lib/scraper/base.ts` for shared HTTP + parsing logic
- Error handling: try-catch in async functions, `console.error` for logging, `process.exit(1)` on fatal errors
- `sync-all.ts` continues past non-critical failures

### Comments

- Japanese comments for domain-specific logic
- ASCII dividers (`// ──`) for section breaks in larger files
- Minimal comments — code should be self-explanatory

## Development Rules

### Workflow

1. **Plan First**: Enter plan mode for non-trivial tasks (3+ steps or architectural decisions)
2. **Write plan** to `tasks/todo.md` with checkable items
3. **Check in** with user before starting implementation
4. **Track progress**: Mark items complete as you go
5. **Verify**: Never mark a task complete without proving it works (`npm run build`, visual check)
6. **Document**: Add review section to `tasks/todo.md`
7. **Capture lessons**: Update `tasks/lessons.md` after corrections

### Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One task per subagent for focused execution

### Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules that prevent the same mistake
- Review lessons at session start

### Autonomous Bug Fixing

- When given a bug report: just fix it — don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user

### Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Demand Elegance (Balanced)**: For non-trivial changes, pause and ask "is there a more elegant way?" Skip this for simple fixes.

## SHINTOKU ATLAS Domain Knowledge

### Site Structure

| Path | Page Name |
|------|-----------|
| `/` | Top page |
| `/gikai/sessions` | 議会を読む (Session list) |
| `/gikai/sessions/[id]` | Individual session page (redirects to /0) |
| `/gikai/sessions/[id]/[partIndex]` | Part-specific session page (SSG) |
| `/gikai` | 町の決定を読む (Decisions list) |
| `/process` | 意思決定の流れを読む (Hub) |
| `/process/issues` | 論点カード (Issue cards) |
| `/process/timeline` | 意思決定タイムライン |
| `/process/priorities` | 重点テーマ |
| `/insights` | データで見る |
| `/map` | 地形を読む (Experimental) |
| `/sources` | 出典一覧 |
| `/about` | About |

### Navigation

- Header: Only 「議会を読む」 and 「About」
- Footer: Flat two columns
  - Column 1: 議会を読む, 町の決定を読む, 意思決定の流れを読む, 地形を読む
  - Column 2: About, Sources, GitHub

### gikai_sessions.json Schema

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

### Session ID Convention

Format: `r{era_year}-{western_year}-{month}-{session_type}`

Examples: `r7-2025-12-regular-4`, `r8-2026-01-rinji-01`

### Tagging Rules

会議の種別と、扱う議案の種別は**別カテゴリ**。両方つく（例: `[定例会, 補正予算, 医療]`）。
`npm run build:data` が `scripts/lib/schema.ts` の `validateTags()` で検証する。詳細は `docs/content-schema.md` §10。

| カテゴリ | 値 | 個数 |
|---|---|---|
| 会議種別 | 定例会, 臨時会, 特別委員会 | ちょうど1（違反はエラー） |
| 議案種別 | 当初予算, 補正予算, 決算 | 0 または 1（違反はエラー） |
| 属性 | 争点あり, 修正可決あり | 任意（客観的事実フラグ） |
| テーマ | 下記 | 最大6（違反はエラー） |

- Themes: インフラ, 農業, 観光, 宿泊税, 教育, 文化, 子育て, 財政, 医療, 物価高騰対策, 総合計画, エネルギー, 人口政策
- テーマは実際に議論された論点のみ。上記にないテーマタグは警告のみで通る（現在 `住民訴訟` `林業` が該当）

### Issue Cards (/process/issues) — 6 items

Defined as static data in `app/process/issues/page.tsx`:

1. 財政規律 vs 投資・サービス維持 (継続中)
2. 地域医療体制の空白 (継続中)
3. 宿泊税・観光財源の設計 (条例化済み・監視中)
4. ゼロカーボン・エネルギー政策の遅れ (検討中)
5. 農業の持続可能性 (検討中)
6. 地域交流センター「とくとく」の役割 (検討中)

### Design Principles

- Dark theme — subdued, non-partisan, no political assertions
- Green accent color (`accent`) used sparingly — not on every link
- Cards are fully clickable; CTAs kept minimal
- Page titles follow the 「〜を読む」 naming series
- AI-generated summaries always disclose the possibility of errors
- Logo: IBM Plex Sans weight 500, uppercase, wide letter-spacing

### Part Data (`public/data/qna/`)

セッションの各パートに対応する構造化データ。`getPartData()` が以下の順でファイルを探索：
1. `{sessionId}_day{partIndex+1}.json` — 本会議（初日・最終日等）
2. `{sessionId}_part{partIndex+1}.json` — パート別データ
3. `{sessionId}.json` — 単一ファイル（レガシー互換）

`part_type` フィールドで表示コンポーネントを切り替え：
- **未指定** → 一般質問 (`QnaSection` アコーディオン)
- **`"honkaigi"`** → 本会議議案審議 (`HonkaigiSection` アコーディオン)

#### QnaData（一般質問）

```json
{
  "session_id": "r8-2026-03-regular-1",
  "part_index": 1,
  "session_date": "2026-03-12",
  "source_url": "https://www.youtube.com/...",
  "items": [
    {
      "speaker_name": "議員名",
      "speaker_role": "議員",
      "topic_title": "質問テーマ",
      "topic_tags": ["観光", "財政"],
      "question_points": ["質問ポイント1"],
      "answer_summary": "回答要約",
      "answer_points": ["回答ポイント1"],
      "conclusion": "結論",
      "continuing_issues": ["継続課題1"],
      "mentioned_entities": ["固有名詞"],
      "mentioned_numbers": ["具体的数値"]
    }
  ],
  "topics_index": [...]
}
```

#### HonkaigiData（本会議議案）

```json
{
  "session_id": "r8-2026-03-regular-1",
  "part_index": 0,
  "session_date": "2026-03-02",
  "part_type": "honkaigi",
  "source_url": "https://www.youtube.com/...",
  "items": [
    {
      "bill_number": "議案第3号",
      "bill_title": "議案名",
      "bill_tags": ["インフラ", "財政"],
      "summary": "概要",
      "proposer": "提案者名",
      "questions": [
        { "questioner": "議員名", "content": "質問", "answer": "回答" }
      ],
      "result": "可決",
      "result_detail": "挙手全員",
      "referred_to_committee": false
    }
  ],
  "committee_referrals": [
    { "bill_numbers": ["議案第16号〜第26号"], "committee": "予算特別委員会", "note": "..." }
  ]
}
```

#### UI コンポーネント構成

`SessionDetail.tsx` 内のセクション表示順（読者の動線「30秒 → 3分 → 確かめる → 全部調べる」）：
1. タブバー（パート切り替え）
2. **要点カード** (`SessionCards`) — `cards` がある場合
3. スライド (`SlidesSection`) — 画像がある場合。カードがあれば「過去のスライド」として折りたたむ
4. 会議の動画 (`VideoCard`)
5. **この会議で決まったこと** (`HonkaigiSection`, `#giketsu`) — `honkaigiData` がある場合
6. **議員が聞いたこと、町の答え** (`QnaSection`, `#qna`) — `qnaItems` がある場合

議案審議・一般質問は参照資料としてページ下部に置き、summary 直下のページ内リンクから1タップで届くようにしている。
両セクションともアコーディオン形式。ヘッダーはテーマ主役（タグ → タイトル → 発言者/議案番号）のカードデザイン。

**UI表示ラベルは `lib/labels.ts` に一元管理する。** データ層の正式語彙（議案審議・一般質問・委員会付託…）は
変えず、UIでは生活語＋正式名称の併記で出す。コピーの調整はこのファイル1つで完結させること。

### Data Creation Workflow

> **正典は `content/sessions/**` のMarkdownと `session.yaml`。** 仕様は `docs/content-schema.md` が正。
> `public/data/` は `npm run build:data` の生成物であり、**直接編集禁止**。修正は `content/` のMDに対して行うこと。

```
字幕 (transcripts/)  →  MD (content/sessions/)  →  JSON (public/data/)
   Layer 0・不可侵         正典・人がレビューする      生成物・直接編集禁止
```

人間に残る判断は4つだけ。それ以外は `npm run add-session` が自動化する。

1. **セッションIDと種別**（`r8-2026-06-regular-2` / `qna` か `honkaigi` か）
2. **narrativeTitle の承認**（AIが3案を `session.yaml` にコメントで残す。人が選ぶか書き直す）
3. **PRレビュー**（固有名詞・数値・タグ）
4. **要点カードのレビュー**（`reviewed: true` にした後 `npm run cards:generate`。数値とトーンを見て `reviewed: true`）

```
[watcher (cron)] ──新着検知──> Issue（URL・タイトル・公開日）
                                  │ 人間: IDと種別を決めて CLI 起動
                                  ▼
[add-session] ─> 字幕取得 ─> Claude抽出 ─> build:data で検証 ─┬─ OK ─> branch + PR
                                    ▲          │ NG（バリデーションエラー）
                                    └─自己修正（最大2回）┘
                                  │ 人間: PRレビュー → reviewed: true → マージ → 自動デプロイ
```

### Adding a New Session

```bash
npm run add-session -- \
  --id r8-2026-06-regular-2 \
  --url "https://www.youtube.com/watch?v=XXXX" \
  --type honkaigi --part day2 --label "最終日（6/19）" \
  --date 2026-06-19 \
  --title-official "令和8年定例第2回新得町議会" \
  --tags "定例会,補正予算,観光"
```

冪等。同じ `--id --part` で再実行しても字幕は取り直さない（`--force` で上書き）。抽出だけやり直すなら `--force-extract`。

個別に動かす場合:

```bash
npm run fetch:transcript -- --url <url> --out content/sessions/<id>/transcripts/day1.txt
npm run extract:md -- --session <id> --part day1 --type honkaigi
```

スライドPDFは従来どおり別管理: `public/pdf/{sessionId}_part{n}.pdf` を置いて `npm run slides:generate <sessionId> <slideId>`。

**exit code 規約**（`scripts/config.ts` の `EXIT`。watcher・CLI・CI で共有）

| code | 意味 | 対応 |
|---|---|---|
| 0 | 成功 | — |
| 1 | エラー | 人間が対処（URL不正・動画が視聴不可・API失敗） |
| 2 | 字幕が未生成 | 数時間おいて再実行 |
| 3 | 字幕が恒久的に無効 | このセッションは字幕から抽出できない |

会期が複数日にわたり `date` が実時間順とずれる場合は、`session.yaml` に `sortDate`（会期初日）を入れる（スキーマ §2.1）。

### 要点カード（cards.yaml）

旧NotebookLMスライドの後継。**レビュー済みMDの派生物**であり、正典ではない。仕様は `docs/content-schema.md` §11。

```bash
npm run cards:generate -- r8-2026-06-regular-2   # 全パート reviewed:true が前提（違反は exit 1）
```

- 出力は `content/sessions/{id}/cards.yaml`（5〜8枚・`reviewed: false`）。人が読んで直し、`reviewed: true` にする
- `build:data` が検証して `public/data/cards/{id}.json` を生成する（スキーマ違反はビルドを止める）
- `kind` は `headline`（1枚目・必須）/ `number` / `decision`（議案の採決結果）/ `report`（行政報告由来）/ `question` / `next`
- カードがあるセッションでは、旧スライドは「過去のスライド」として折りたたまれる
- OGP画像（`app/gikai/sessions/[id]/opengraph-image.tsx`）は narrativeTitle と1枚目の headline から作る。
  和文フォント（Zen Old Mincho）はビルド時に Google Fonts から取得し、失敗時は英数字のみで生成する（ビルドは止めない）
- 過去セッションへの遡及生成はしていない（旧PDFスライドが役割を果たしているため）

### Known Issues

- **既存26パート中15本の YouTube 動画が非公開化されている**（`playabilityStatus: LOGIN_REQUIRED`）。R6全部とR7初期。サイト上のリンクが死んでおり、字幕からの再抽出もできない
- `content/` の議員名に誤りが4件残っている（`桜田`→`櫻田`、`斎藤`→`齊藤`、`福原 之行`→`福原 智幸`、`松山委員` は名簿に該当者なし）。詳細は `scripts/prompts/glossary.md`
- `public/data/qna/*.json` の `topics_index` は3種類のスキーマが混在している。現在はMDの `_passthrough` に無加工で退避しているだけで、正規化は未着手
- Missing parts for some R6 (令和6年) sessions (first/final day not yet added)
- Mobile display needs review and improvement
- Top page module cards not visible without scrolling
