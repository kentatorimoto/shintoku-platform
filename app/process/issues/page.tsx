import type { Metadata } from "next"
import Link from "next/link"
import { ISSUES, isHot } from "../issuesData"

export const metadata: Metadata = {
  title: "論点カード | Shintoku Atlas",
  description: "複数の会議をまたいで繰り返されている争点を時系列で読む",
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
}

export default function IssuesPage() {
  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">

      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="mb-10">
        <Link
          href="/process"
          className="text-textSub text-sm hover:text-textMain transition-colors mb-4 inline-block"
        >
          ← 流れを読む
        </Link>
        <h1 className="font-mincho text-4xl md:text-5xl font-bold tracking-tight mb-4">
          論点カード
        </h1>
        <p className="text-textSub text-lg">
          複数の会議をまたいで繰り返されている争点
        </p>
      </div>

      {/* ── 論点カード一覧 ──────────────────────────────────────────────── */}
      <div className="space-y-8">
        {ISSUES.map((issue) => (
          <section
            key={issue.id}
            className="bg-ink border border-line rounded-[3px] p-6"
          >
            {/* カードヘッダー */}
            <div className="flex flex-wrap items-start gap-3 mb-4">
              <h2 className="font-mincho text-xl font-bold text-textMain leading-snug flex-1 min-w-0">
                {issue.title}
              </h2>
              <span
                className={`shrink-0 text-[11.5px] font-semibold px-[9px] py-[2px] rounded-[3px] border ${
                  isHot(issue.status)
                    ? "text-accent border-accent/50"
                    : "text-textSub border-lineStrong"
                }`}
              >
                {issue.status}
              </span>
            </div>

            {/* サマリー */}
            <p className="text-sm leading-relaxed text-textMain/80 mb-6">
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
                    <p className="mono text-[12px] text-textSub mb-0.5">
                      {formatDate(s.date)}
                    </p>
                    <p className="text-sm font-medium text-textMain leading-snug mb-1">
                      {s.title}
                    </p>
                    <p className="text-xs text-textSub leading-relaxed">
                      {s.conflict}
                    </p>
                  </div>
                  <Link
                    href={`/gikai/sessions/${s.sessionId}`}
                    className="shrink-0 text-xs text-accent hover:opacity-70 transition-opacity whitespace-nowrap pt-0.5"
                  >
                    → 会議を読む
                  </Link>
                </div>
              ))}
            </div>

            {/* タイムラインリンク */}
            <div className="border-t border-line pt-4 flex flex-wrap gap-x-6 gap-y-2">
              <Link
                href={`/process/timeline?tag=${encodeURIComponent(issue.timelineTag)}`}
                className="text-sm text-accent hover:opacity-70 transition-opacity"
              >
                タイムラインで見る →
              </Link>
              {issue.detailHref && (
                <Link
                  href={issue.detailHref}
                  className="text-sm text-accent hover:opacity-70 transition-opacity"
                >
                  意思決定の流れを読む →
                </Link>
              )}
            </div>
          </section>
        ))}
      </div>

    </div>
  )
}
