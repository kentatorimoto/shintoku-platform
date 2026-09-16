"use client"

import { useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import GiketsuCountBadge from "@/components/GiketsuCountBadge"
import { SESSION_SUMMARY_LABELS } from "@/lib/labels"
import { leadSentence } from "@/lib/text"

// ── 型定義 ─────────────────────────────────────────────────────────────────
interface Part {
  label:     string
  youtube?:  string
  pdf?:      string
  slidesDir?: string
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

// ── 表示のための導出 ────────────────────────────────────────────────────────

/** 日付は全ページ共通でドット区切りの等幅（2026.09.01）。 */
const toDot = (iso: string) => iso.replace(/-/g, ".")

const MEETING_TAGS = ["定例会", "臨時会", "特別委員会"]
const meetingTag = (tags: string[]) => tags.find(t => MEETING_TAGS.includes(t)) ?? ""

// ── タグの表示順を固定 ──────────────────────────────────────────────────────
const TAG_ORDER = [
  "定例会", "臨時会", "特別委員会",
  "当初予算", "補正予算", "決算",
  "インフラ", "農業", "観光", "宿泊税", "教育", "文化", "子育て", "財政", "医療",
  "物価高騰対策", "総合計画", "エネルギー", "人口政策",
  "争点あり", "修正可決あり",
]

// ──────────────────────────────────────────────────────────────────────────────

export default function SessionsList({ sessions, giketsuMap }: Props) {
  const searchParams = useSearchParams()
  const initialTag = searchParams.get("tag")

  const [selectedTags, setSelectedTags] = useState<string[]>(() => (initialTag ? [initialTag] : []))
  // タグ指定で来たときだけ絞り込みを開いた状態にする（何で絞られているか分からないまま
  // 件数が減っていると、記録が欠けているように見えるため）。
  const [filterOpen, setFilterOpen] = useState(Boolean(initialTag))

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
    return sessions.filter((s) => selectedTags.every((t) => s.tags.includes(t)))
  }, [sessions, selectedTags])

  const total = sessions.length

  // NO. は絞り込みに関係なく全体での通し番号。配列は新しい順なので先頭が最大。
  const numberOf = useMemo(
    () => new Map(sessions.map((s, i) => [s.id, total - i])),
    [sessions, total]
  )

  return (
    <>
      {/* ── 一覧 ────────────────────────────────────────────────────────
          記録を先に出す。条件は下に畳む（/gikai と同じ順序）。
          タグは24種あるのに記録は19件で、絞り込みを先に置くと壁になっていた。 */}
      <section className="border-t-[1.5px] border-textMain">
        <div className="flex items-baseline justify-between pt-4 pb-1.5">
          <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textMuted">
            会期の記録 — {filtered.length}件
            {selectedTags.length > 0 && (
              <span className="mono text-[11px] text-textMuted ml-2">/ 全{total}件</span>
            )}
          </h2>
          <span className="mono text-[11.5px] text-textMuted">
            NO.1 — NO.{total}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="text-textMuted text-center py-16 text-[13.5px]">
            この条件に当てはまる会期はありません
          </p>
        ) : (
          filtered.map((session) => {
            const no   = numberOf.get(session.id)
            const g    = giketsuMap[session.id]
            const lead = leadSentence(session.summary?.issues)

            return (
              <Link
                key={session.id}
                href={`/gikai/sessions/${session.id}`}
                className="group grid grid-cols-[52px_1fr_auto] md:grid-cols-[72px_92px_1fr_auto] items-baseline
                           gap-3 md:gap-5 py-4 px-1 border-b border-line rounded-[3px] transition-colors hover:bg-hover"
              >
                <span className="mono text-textMuted text-[13px]">NO.{no}</span>
                <span className="mono text-textMuted text-[13px] hidden md:block">{toDot(session.date)}</span>

                <span className="min-w-0">
                  <span className="block text-[14px] font-bold leading-snug text-textMain">
                    {session.narrativeTitle ?? session.officialTitle}
                  </span>
                  <span className="mono block md:hidden text-textMuted text-[11px] font-normal mt-0.5">
                    {toDot(session.date)}
                  </span>

                  {/* 論点の1文目だけ。途中で切らずに文の切れ目で止める */}
                  {lead && (
                    <span className="block text-[12.5px] text-textMuted font-normal mt-1 leading-relaxed">
                      {SESSION_SUMMARY_LABELS.issues.text} — {lead}
                    </span>
                  )}

                  {/* パートと議決件数。記録がどこまで揃っているかの目印 */}
                  <span className="flex flex-wrap items-center gap-1.5 mt-2">
                    {session.parts.map((part, i) => (
                      <span
                        key={part.slidesDir ?? `${part.label}-${i}`}
                        className="inline-flex items-center gap-1 text-[11px] text-textMuted
                                   border border-line rounded-[3px] px-2 py-[2px]"
                      >
                        {part.youtube && (
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10
                                     10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
                                     0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                          </svg>
                        )}
                        {part.pdf && (
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0
                                     2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
                          </svg>
                        )}
                        {part.label}
                      </span>
                    ))}
                    {g && <GiketsuCountBadge count={g.count} sessionName={g.sessionName} />}
                  </span>
                </span>

                <span className="text-[11px] text-textMuted border border-lineStrong rounded-[3px]
                                 px-2 py-[2px] whitespace-nowrap justify-self-end">
                  {meetingTag(session.tags)}
                </span>
              </Link>
            )
          })
        )}
      </section>

      {/* ── 絞り込み ────────────────────────────────────────────────────
          記録を読み終えた読者が、次に「似た会期を探す」ための道具。
          条件があるときは畳んでいても分かるようにする。 */}
      <details
        className="group mt-6"
        open={filterOpen}
        onToggle={(e) => setFilterOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="flex items-center gap-2 cursor-pointer list-none py-1
                            text-[12.5px] font-bold text-textMuted hover:text-textMain transition-colors">
          <span>テーマで絞り込む</span>
          {selectedTags.length > 0 && (
            <span className="mono text-[11px] text-accent">{selectedTags.length}件選択中</span>
          )}
          <span className="mono text-[11px] text-textMuted group-open:hidden">開く ↓</span>
          <span className="mono text-[11px] text-textMuted hidden group-open:inline">閉じる ↑</span>
        </summary>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTags([])}
            className={`px-3 py-2 rounded-[3px] text-sm font-medium transition-colors border ${
              selectedTags.length === 0
                ? "bg-accent text-onAccent border-accent"
                : "bg-ink border-lineStrong text-textMuted hover:border-accent hover:text-textMain"
            }`}
          >
            すべて
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-2 rounded-[3px] text-sm font-medium transition-colors border ${
                selectedTags.includes(tag)
                  ? "bg-accent text-onAccent border-accent"
                  : "bg-ink border-lineStrong text-textMuted hover:border-accent hover:text-textMain"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {selectedTags.length > 0 && (
          <p className="text-[12px] text-textMuted mt-3">
            選んだテーマをすべて含む会期だけを出しています（AND 条件）。
          </p>
        )}
      </details>
    </>
  )
}
