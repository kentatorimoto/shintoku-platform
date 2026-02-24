import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "論点カード | Shintoku Atlas",
  description: "複数の会議をまたいで繰り返されている争点を時系列で読む",
}

// ── 型定義 ─────────────────────────────────────────────────────────────────
interface SessionRef {
  sessionId: string
  date:      string
  title:     string
  conflict:  string
}

interface Issue {
  id:          string
  title:       string
  status:      string
  statusColor: string
  summary:     string
  timelineTag: string
  sessions:    SessionRef[]
}

// ── 静的データ ──────────────────────────────────────────────────────────────
const ISSUES: Issue[] = [
  {
    id: "fiscal-balance",
    title: "財政規律 vs 投資・サービス維持",
    status: "継続中",
    statusColor: "text-red-400 border-red-400/40",
    summary: "借金が貯金を上回る財政状況の中で、必要な投資規模をどう確保するか。毎回の予算・決算審議で繰り返し浮上している。",
    timelineTag: "財政",
    sessions: [
      { sessionId: "r6-2024-09-kessan-tokubetsu", date: "2024-09-13", title: "令和5年度決算審査", conflict: "財政調整基金の残高と今後の財源確保" },
      { sessionId: "r7-2025-03-regular-1",        date: "2025-03-03", title: "令和7年度当初予算", conflict: "予算の規模・重点配分バランス" },
      { sessionId: "r7-2025-03-yosan-tokubetsu",  date: "2025-03-17", title: "予算審査特別委員会", conflict: "北斗クリニック医療転換・3本柱の投資規模" },
      { sessionId: "r7-2025-09-regular-3",        date: "2025-09-01", title: "令和7年定例第3回", conflict: "財政規律と未来投資の狭間" },
      { sessionId: "r7-2025-09-kessan-tokubetsu", date: "2025-09-12", title: "令和6年度決算審査", conflict: "貯金が借金を下回った財政構造の検証" },
    ],
  },
  {
    id: "tourism-tax",
    title: "宿泊税・観光財源の設計",
    status: "条例化済み・監視中",
    statusColor: "text-yellow-400 border-yellow-400/40",
    summary: "宿泊税は令和7年定例第2回で条例制定。税率設定（50〜500円）と観光財源としての使途が争点だった。徴収開始後の実績が次の焦点。",
    timelineTag: "観光",
    sessions: [
      { sessionId: "r6-2024-06-regular-2", date: "2024-06-04", title: "令和6年定例第2回", conflict: "宿泊税導入の是非と税率設計" },
      { sessionId: "r6-2024-09-regular-3", date: "2024-09-02", title: "令和6年定例第3回", conflict: "観光財源の使途と配分方針" },
      { sessionId: "r7-2025-06-regular-2", date: "2025-06-02", title: "令和7年定例第2回", conflict: "税率設定（50〜500円）と観光財源の使途" },
    ],
  },
  {
    id: "zero-carbon",
    title: "ゼロカーボン・エネルギー政策の遅れ",
    status: "検討中",
    statusColor: "text-blue-400 border-blue-400/40",
    summary: "新得町のエネルギー資源（水力・バイオマス等）活用が政策として具体化されていない。ゼロカーボン調査が進行中だが結論未出。",
    timelineTag: "エネルギー",
    sessions: [
      { sessionId: "r6-2024-09-regular-3",    date: "2024-09-02", title: "令和6年定例第3回", conflict: "エネルギー資源活用の遅れ" },
      { sessionId: "r7-2025-06-regular-2",     date: "2025-06-02", title: "令和7年定例第2回", conflict: "ゼロカーボン調査の予算計上" },
      { sessionId: "r8-2026-01-20-basic-plan", date: "2026-01-20", title: "第9期総合計画審査特別委", conflict: "長期計画へのエネルギー政策の位置づけ" },
    ],
  },
  {
    id: "medical-gap",
    title: "地域医療体制の空白",
    status: "継続中",
    statusColor: "text-red-400 border-red-400/40",
    summary: "北斗クリニック閉院（令和6年）以降、巡回診療での対応が続く。新得クリニック閉院後の体制が複数の会議で繰り返し問題になっている。",
    timelineTag: "医療",
    sessions: [
      { sessionId: "r6-2024-09-regular-3",       date: "2024-09-02", title: "令和6年定例第3回", conflict: "医療空白への対応が初めて議題に" },
      { sessionId: "r7-2025-03-yosan-tokubetsu",  date: "2025-03-17", title: "予算審査特別委員会", conflict: "巡回診療体制の確認" },
      { sessionId: "r7-2025-09-kessan-tokubetsu", date: "2025-09-12", title: "令和6年度決算審査", conflict: "閉院後の巡回診療継続を確認" },
      { sessionId: "r7-2025-12-regular-4",        date: "2025-12-02", title: "令和7年定例第4回", conflict: "地域医療体制の継続議論" },
    ],
  },
  {
    id: "agriculture-sustainability",
    title: "農業の持続可能性",
    status: "検討中",
    statusColor: "text-blue-400 border-blue-400/40",
    summary: "新得町の基幹産業である農業が、農家戸数の減少・担い手不足・気候変動対応という課題を抱える。議会での議論はまだ少ない。",
    timelineTag: "農業",
    sessions: [
      { sessionId: "r6-2024-09-regular-3", date: "2024-09-02", title: "令和6年定例第3回", conflict: "農業関連の補正予算" },
      { sessionId: "r7-2025-02-rinji-1",   date: "2025-02-03", title: "令和7年臨時第1回", conflict: "農業支援の物価高騰対策" },
      { sessionId: "r7-2025-12-regular-4", date: "2025-12-02", title: "令和7年定例第4回", conflict: "農業防疫・担い手問題の議論" },
    ],
  },
  {
    id: "tokutoku-role",
    title: "地域交流センター「とくとく」の役割",
    status: "検討中",
    statusColor: "text-blue-400 border-blue-400/40",
    summary: "観光拠点として整備された「とくとく」が、町民の日常利用の場としても機能すべきかをめぐる議論。令和7年12月定例会で浮上。",
    timelineTag: "観光",
    sessions: [
      { sessionId: "r7-2025-12-regular-4", date: "2025-12-02", title: "令和7年定例第4回", conflict: "観光拠点 vs 日常利用の議論が一般質問で浮上" },
    ],
  },
]

// ── 日付フォーマット ────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
}

// ──────────────────────────────────────────────────────────────────────────────

export default function IssuesPage() {
  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">

      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="mb-10">
        <Link
          href="/process"
          className="text-textSub text-sm hover:text-textMain transition-colors mb-4 inline-block"
        >
          ← 意思決定の流れを読む
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          論点カード
        </h1>
        <p className="text-textMain/70 text-lg">
          複数の会議をまたいで繰り返されている争点
        </p>
      </div>

      {/* ── 論点カード一覧 ──────────────────────────────────────────────── */}
      <div className="space-y-8">
        {ISSUES.map((issue) => (
          <section
            key={issue.id}
            className="bg-ink border border-line rounded-xl p-6"
          >
            {/* カードヘッダー */}
            <div className="flex flex-wrap items-start gap-3 mb-4">
              <h2 className="text-lg font-semibold text-textMain leading-snug flex-1 min-w-0">
                {issue.title}
              </h2>
              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${issue.statusColor}`}>
                {issue.status}
              </span>
            </div>

            {/* サマリー */}
            <p className="text-sm leading-relaxed text-textMain/70 mb-6">
              {issue.summary}
            </p>

            {/* 時系列リスト */}
            <div className="space-y-3 mb-6">
              {issue.sessions.map((s) => (
                <div
                  key={s.sessionId}
                  className="flex gap-4 items-start border-l-2 border-line pl-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-accent font-semibold mb-0.5">
                      {formatDate(s.date)}
                    </p>
                    <p className="text-sm font-medium text-textMain leading-snug mb-1">
                      {s.title}
                    </p>
                    <p className="text-xs text-textMain/60 leading-relaxed">
                      {s.conflict}
                    </p>
                  </div>
                  <Link
                    href={`/gikai/sessions/${s.sessionId}`}
                    className="shrink-0 text-xs text-accent hover:text-accent/70 transition-colors whitespace-nowrap pt-0.5"
                  >
                    → 会議を読む
                  </Link>
                </div>
              ))}
            </div>

            {/* タイムラインリンク */}
            <div className="border-t border-line/40 pt-4">
              <Link
                href={`/process/timeline?tag=${encodeURIComponent(issue.timelineTag)}`}
                className="text-sm text-accent hover:text-accent/70 transition-colors"
              >
                タイムラインで見る →
              </Link>
            </div>
          </section>
        ))}
      </div>

    </div>
  )
}
