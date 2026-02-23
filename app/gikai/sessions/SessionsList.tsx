"use client"

import { useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import GiketsuCountBadge from "@/components/GiketsuCountBadge"

// ── 型定義 ─────────────────────────────────────────────────────────────────
interface Part {
  label:     string
  youtube?:  string
  pdf?:      string
  slidesDir: string
}

interface Summary {
  issues:      string
  conflicts:   string
  nextActions: string
}

export interface GikaiSession {
  id:              string
  officialTitle:   string
  narrativeTitle?: string
  date:            string
  tags:            string[]
  summary?:        Summary
  parts:           Part[]
}

interface Props {
  sessions:   GikaiSession[]
  giketsuMap: Record<string, { count: number; sessionName: string }>
}

// ── 日付フォーマット ────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  })
}

// ── タグの表示順を固定 ──────────────────────────────────────────────────────
const TAG_ORDER = [
  "定例会", "臨時会", "特別委員会",
  "当初予算", "補正予算", "決算",
  "インフラ", "農業", "観光", "教育", "子育て", "財政",
  "物価高騰対策", "総合計画", "エネルギー", "人口政策",
  "争点あり", "修正可決あり",
]

// ──────────────────────────────────────────────────────────────────────────────

export default function SessionsList({ sessions, giketsuMap }: Props) {
  const searchParams = useSearchParams()
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tag = searchParams.get("tag")
    return tag ? [tag] : []
  })

  // セッションに含まれるタグのみ、TAG_ORDER 順で収集
  const allTags = useMemo(() => {
    const inData = new Set(sessions.flatMap((s) => s.tags))
    const ordered = TAG_ORDER.filter((t) => inData.has(t))
    const rest = [...inData].filter((t) => !TAG_ORDER.includes(t)).sort()
    return [...ordered, ...rest]
  }, [sessions])

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const filtered = useMemo(() => {
    if (selectedTags.length === 0) return sessions
    return sessions.filter((s) =>
      selectedTags.every((t) => s.tags.includes(t))
    )
  }, [sessions, selectedTags])

  return (
    <>
      {/* ── タグフィルター ───────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTags([])}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              selectedTags.length === 0
                ? "bg-accent text-base border-accent"
                : "bg-ink border-line text-textSub hover:border-accent/50"
            }`}
          >
            すべて
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                selectedTags.includes(tag)
                  ? "bg-accent text-base border-accent"
                  : "bg-ink border-line text-textSub hover:border-accent/50"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        {selectedTags.length > 0 && (
          <p className="text-xs text-textSub mt-2">
            {filtered.length} 件ヒット（AND 条件）
          </p>
        )}
      </div>

      {/* ── セッション一覧 ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="text-textSub text-center py-20">該当する会議がありません</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((session) => {
            const g = giketsuMap[session.id]
            return (
              <Link
                key={session.id}
                href={`/gikai/sessions/${session.id}`}
                className="block bg-ink border border-line rounded-xl p-5 hover:border-accent transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* 日付 */}
                    <p className="text-xs text-accent font-semibold tracking-wide mb-1.5">
                      {formatDate(session.date)}
                    </p>
                    {/* タイトル */}
                    <h2 className="text-base md:text-lg font-semibold text-textMain
                                    group-hover:text-accent/90 transition-colors leading-snug mb-1">
                      {session.narrativeTitle ?? session.officialTitle}
                    </h2>
                    {session.narrativeTitle && (
                      <p className="text-xs text-textSub/60 mb-2 leading-snug">
                        {session.officialTitle}
                      </p>
                    )}
                    {/* タグバッジ */}
                    {session.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {session.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`text-[11px] rounded px-1.5 py-0.5 ${
                              selectedTags.includes(tag)
                                ? "bg-accent/15 text-accent border border-accent/30"
                                : "bg-line text-textSub/70"
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* サマリー */}
                    {session.summary && (
                      <dl className="mb-3 space-y-0.5">
                        {([
                          { dt: "論点",       dd: session.summary.issues },
                          { dt: "争点",       dd: session.summary.conflicts },
                          { dt: "次アクション", dd: session.summary.nextActions },
                        ] as const).map(({ dt, dd }) => dd && (
                          <div key={dt} className="flex gap-1.5 items-baseline">
                            <dt className="text-[11px] text-textSub/50 whitespace-nowrap shrink-0">{dt}：</dt>
                            <dd className="text-sm leading-relaxed text-textMain/70 break-words line-clamp-1">{dd}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {/* パートバッジ */}
                    <div className="flex flex-wrap gap-2">
                      {session.parts.map((part) => (
                        <span
                          key={part.slidesDir}
                          className="inline-flex items-center gap-1.5 text-xs
                                     bg-line text-textSub rounded-full px-2.5 py-0.5"
                        >
                          {part.youtube && (
                            <svg className="w-3 h-3 text-red-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10
                                       10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
                                       0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                            </svg>
                          )}
                          {part.pdf && (
                            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0
                                       2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
                            </svg>
                          )}
                          {part.label}
                        </span>
                      ))}
                    </div>
                    {/* 議決件数バッジ */}
                    {g && (
                      <div className="mt-2">
                        <GiketsuCountBadge count={g.count} sessionName={g.sessionName} />
                      </div>
                    )}
                  </div>
                  <span className="text-textSub/40 text-xl shrink-0 mt-1
                                    group-hover:text-accent/60 transition-colors">
                    →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
