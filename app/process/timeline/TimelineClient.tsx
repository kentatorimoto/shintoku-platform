"use client"

import { useState, useMemo } from "react"
import Link from "next/link"

// ── 型定義 ─────────────────────────────────────────────────────────────────
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
}

interface Props {
  sessions:    GikaiSession[]
  initialTag?: string
}

// ── タグ表示順 ──────────────────────────────────────────────────────────────
const TAG_ORDER = [
  "定例会", "臨時会", "特別委員会",
  "当初予算", "補正予算", "決算",
  "インフラ", "農業", "観光", "教育", "文化", "子育て", "財政",
  "物価高騰対策", "総合計画", "エネルギー", "人口政策",
  "争点あり", "修正可決あり",
]

// ── 日付フォーマット ────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  })
}

// ──────────────────────────────────────────────────────────────────────────────

export default function TimelineClient({ sessions, initialTag = "エネルギー" }: Props) {
  // 全タグを TAG_ORDER 順で収集
  const allTags = useMemo(() => {
    const inData = new Set(sessions.flatMap((s) => s.tags))
    const ordered = TAG_ORDER.filter((t) => inData.has(t))
    const rest = [...inData].filter((t) => !TAG_ORDER.includes(t)).sort()
    return [...ordered, ...rest]
  }, [sessions])

  // initialTag がデータに存在すればそれを、なければ先頭タグを初期値に
  const defaultTag = allTags.includes(initialTag) ? initialTag : (allTags[0] ?? "")
  const [selectedTag, setSelectedTag] = useState(defaultTag)

  // 日付昇順（古い順）でフィルタリング
  const filtered = useMemo(() =>
    sessions
      .filter((s) => s.tags.includes(selectedTag))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [sessions, selectedTag]
  )

  return (
    <>
      {/* ── タグ選択（単一選択） ─────────────────────────────────────── */}
      <div className="mb-10 flex flex-wrap gap-2">
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              selectedTag === tag
                ? "bg-accent text-base border-accent"
                : "bg-ink border-line text-textSub hover:border-accent/50"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* ── タイムライン ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="text-textSub text-center py-20">
          このテーマの記録はまだありません
        </p>
      ) : (
        <div className="space-y-0">
          {filtered.map((session, i) => {
            const isLast = i === filtered.length - 1
            return (
              <div key={session.id} className="flex gap-5">
                {/* ── 左レール ── */}
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-accent/20 shrink-0" />
                  {!isLast && <div className="w-px flex-1 bg-line mt-2 mb-0" />}
                </div>

                {/* ── 会議カード ── */}
                <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-8"}`}>
                  <p className="text-xs text-accent font-semibold tracking-wide mb-2">
                    {formatDate(session.date)}
                  </p>
                  <div className="bg-ink border border-line rounded-xl p-5 hover:border-accent transition-all group">
                    <h3 className="text-base md:text-lg font-semibold text-textMain
                                   group-hover:text-accent/90 transition-colors leading-snug mb-1">
                      {session.narrativeTitle ?? session.officialTitle}
                    </h3>
                    {session.narrativeTitle && (
                      <p className="text-xs text-textSub/60 mb-3 leading-snug">
                        {session.officialTitle}
                      </p>
                    )}
                    {session.summary && (
                      <dl className="mb-4 space-y-1">
                        {([
                          { dt: "論点",       dd: session.summary.issues },
                          { dt: "争点",       dd: session.summary.conflicts },
                          { dt: "次アクション", dd: session.summary.nextActions },
                        ] as const).map(({ dt, dd }) => dd && (
                          <div key={dt} className="flex gap-1.5 items-baseline">
                            <dt className="text-[11px] text-textSub/50 whitespace-nowrap shrink-0">
                              {dt}：
                            </dt>
                            <dd className="text-sm leading-relaxed text-textMain/70 break-words">
                              {dd}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <Link
                      href={`/gikai/sessions/${session.id}`}
                      className="inline-flex items-center text-xs text-accent
                                 hover:text-accent/70 transition-colors"
                    >
                      会議を読む →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
