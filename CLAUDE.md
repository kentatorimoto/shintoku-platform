# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Shintoku Atlas** — an unofficial public information dashboard for Shintoku Town (新得町), Hokkaido, Japan. Scrapes municipal data from the official town website and presents it in a searchable, accessible format. Licensed under AGPL-3.0.

Key features:
- Gikai (議会) session viewer with PDF slides, YouTube links, and AI-generated summaries
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
├── scripts/                      # Data scripts (run via tsx)
│   ├── sync-all.ts               # Master sync orchestrator
│   ├── scrape-announcements.ts
│   ├── scrape-newsletters.ts
│   ├── scrape-giketsu.ts
│   ├── index-newsletters.ts      # Full-text index builder
│   ├── convertSlides.mjs         # PDF → JPEG slides (requires poppler)
│   ├── addSession.mjs            # Add new session helper
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
│   ├── data/                     # Public JSON datasets (served)
│   │   ├── gikai_sessions.json   # Core session metadata
│   │   ├── gikai_links.json      # Session-to-decision links
│   │   ├── giketsu_index.json    # Decisions full-text index
│   │   ├── newsletters_index.json # Newsletter search index (~3MB)
│   │   ├── decision_links.json
│   │   ├── basin_questions.json
│   │   ├── lastSync.json
│   │   └── *.geojson             # Map layers
│   ├── pdf/                      # Gikai session PDFs
│   └── slides/                   # Generated slide images
├── tasks/                        # Task tracking files
├── .github/workflows/            # CI/CD
│   ├── daily-sync.yml            # npm run sync at 12:00 JST
│   └── daily-scrape.yml          # test-scraper at 09:00 JST
├── next.config.ts                # Minimal (no custom config)
├── tsconfig.json                 # strict: true, @/* path alias
├── eslint.config.mjs             # next/core-web-vitals + typescript
└── postcss.config.mjs            # @tailwindcss/postcss
```

## Commands

```bash
# Development
npm run dev              # Start Next.js dev server (http://localhost:3000)
npm run build            # Production build (runs build:links then next build)
npm run lint             # ESLint

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

```
Official town website (shintoku-town.jp)
  ↓  Cheerio + Axios (scripts/)
Local scraped data (data/scraped/)
  ↓  Processing & indexing
Public JSON (public/data/*.json)
  ↓  fetch() at build/runtime
Next.js App Router pages (app/)
```

GitHub Actions automates:
- `daily-sync.yml`: Runs `npm run sync` + `index:newsletters` at 12:00 JST, commits `public/data/` changes
- `daily-scrape.yml`: Runs `test-scraper.ts` at 09:00 JST, commits `data/scraped/` changes

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
| `/gikai/sessions/[id]` | Individual session page |
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

1. Always include exactly 1 session type tag
2. Theme tags limited to topics actually discussed (max 5-6)
3. 「争点あり」「修正可決あり」 are objective fact tags

Available tags:
- Session types: 定例会, 臨時会, 特別委員会, 当初予算, 補正予算, 決算
- Themes: インフラ, 農業, 観光, 宿泊税, 教育, 文化, 子育て, 財政, 医療, 物価高騰対策, 総合計画, エネルギー, 人口政策
- Attributes: 争点あり, 修正可決あり

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

### Adding a New Session

1. Copy PDF to `public/pdf/` with naming `{sessionId}_part{n}.pdf`
2. Run `npm run slides:generate <sessionId> <slideId>` to generate slide images
3. Add new session entry to `public/data/gikai_sessions.json`
4. Apply tags following the tagging rules above

### Known Issues

- Missing parts for some R6 (令和6年) sessions (first/final day not yet added)
- Mobile display needs review and improvement
- Top page module cards not visible without scrolling
