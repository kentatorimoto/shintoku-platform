import fs from "fs"
import path from "path"
import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import GiketsuCountBadge from "@/components/GiketsuCountBadge"
import { LABELS, SESSION_SUMMARY_LABELS } from "@/lib/labels"
import { leadSentence } from "@/lib/text"
import SessionFilter from "./SessionFilter"

export const metadata: Metadata = {
  title: `${LABELS.sessions.text} | Shintoku Atlas`,
  description: "新得町議会のライブ配信を要約・構造化し、意思決定の記録としてアーカイブしています。",
}

// ── 型定義 ─────────────────────────────────────────────────────────────────

interface Part {
  label:      string
  youtube?:   string
  pdf?:       string
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

interface GiketsuSession {
  sessionId:   string | null
  sessionName: string
  items:       unknown[]
}

// ── データ読み込み ──────────────────────────────────────────────────────────

function getSessions(): GikaiSession[] {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as GikaiSession[]
  } catch {
    return []
  }
}

function getGiketsuMap(): Record<string, { count: number; sessionName: string }> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "giketsu_index.json")
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as GiketsuSession[]
    const map: Record<string, { count: number; sessionName: string }> = {}
    for (const s of data) {
      if (s.sessionId) map[s.sessionId] = { count: s.items.length, sessionName: s.sessionName }
    }
    return map
  } catch {
    return {}
  }
}

// ── 表示のための導出 ────────────────────────────────────────────────────────

/** 日付は全ページ共通でドット区切りの等幅（2026.09.01）。 */
const toDot = (iso: string) => iso.replace(/-/g, ".")

const MEETING_TAGS = ["定例会", "臨時会", "特別委員会"]
const meetingTag = (tags: string[]) => tags.find(t => MEETING_TAGS.includes(t)) ?? ""

/** 絞り込みのボタンの並び。データに在るものだけを、この順で出す。 */
const TAG_ORDER = [
  "定例会", "臨時会", "特別委員会",
  "当初予算", "補正予算", "決算",
  "インフラ", "農業", "観光", "宿泊税", "教育", "文化", "子育て", "財政", "医療",
  "物価高騰対策", "総合計画", "エネルギー", "人口政策",
  "争点あり", "修正可決あり",
]

function orderedTags(sessions: GikaiSession[]): string[] {
  const inData = new Set(sessions.flatMap(s => s.tags))
  const ordered = TAG_ORDER.filter(t => inData.has(t))
  const rest = [...inData].filter(t => !TAG_ORDER.includes(t)).sort()
  return [...ordered, ...rest]
}

// ──────────────────────────────────────────────────────────────────────────────

export default function GikaiSessionsPage() {
  const sessions   = getSessions()
  const giketsuMap = getGiketsuMap()
  const total      = sessions.length

  return (
    <div className="max-w-[1040px] mx-auto px-6">

      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="pt-12 pb-2 mb-8">
        <p className="text-[12px] font-bold tracking-[0.14em] text-accent mb-3">
          {LABELS.sessions.formal}の索引
        </p>
        <h1
          className="font-mincho font-bold leading-[1.4] text-textMain"
          style={{ fontSize: "clamp(26px, 4vw, 38px)" }}
        >
          {LABELS.sessions.text}
        </h1>
        <p className="text-[13.5px] text-textMuted mt-2.5 max-w-[560px]">
          新得町議会のライブ配信を要約・構造化し、意思決定の記録としてアーカイブしています。
          AIによる要約を含むため、内容に誤りがある場合があります。
        </p>
        <Link
          href="/gikai"
          className="group inline-block text-[13px] font-bold border-b-2 border-textMain pb-[2px] mt-4
                     transition-colors hover:text-accent hover:border-accent"
        >
          {LABELS.giketsu.text}を読む →
        </Link>
      </div>

      {/* ── 一覧 ────────────────────────────────────────────────────────
          サーバーで描く。以前は絞り込みと同じクライアントコンポーネントに入っていて、
          useSearchParams() の Suspense 境界の内側にあったため、ハイドレーションが
          終わるまで「読み込み中…」のままだった。絞り込みは CSS で行うので、
          記録そのものは最初のHTMLに入る。 */}
      {total === 0 ? (
        <p className="text-textMuted text-center py-20">会議データがありません</p>
      ) : (
        <>
          <section className="border-t-[1.5px] border-textMain">
            <div className="flex items-baseline justify-between pt-4 pb-1.5">
              <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textMuted">
                会期の記録 — 全{total}件
              </h2>
              <span className="mono text-[11.5px] text-textMuted">NO.1 — NO.{total}</span>
            </div>

            {sessions.map((session, i) => {
              const g = giketsuMap[session.id]
              const lead = leadSentence(session.summary?.issues)

              return (
                <Link
                  key={session.id}
                  href={`/gikai/sessions/${session.id}`}
                  data-session-row
                  data-tags={session.tags.join(" ")}
                  className="group grid grid-cols-[52px_1fr_auto] md:grid-cols-[72px_92px_1fr_auto] items-baseline
                             gap-3 md:gap-5 py-4 px-1 border-b border-line rounded-[3px] transition-colors hover:bg-hover"
                >
                  <span className="mono text-textMuted text-[13px]">NO.{total - i}</span>
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
                      {session.parts.map((part, j) => (
                        <span
                          key={part.slidesDir ?? `${part.label}-${j}`}
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
            })}
          </section>

          {/* ── 絞り込み ──────────────────────────────────────────────
              記録を読み終えた読者が、次に「似た会期を探す」ための道具。
              useSearchParams() を使うので Suspense が要るが、境界はここだけに閉じる。 */}
          <Suspense fallback={<div className="h-10" />}>
            <SessionFilter sessionTags={sessions.map(s => s.tags)} allTags={orderedTags(sessions)} />
          </Suspense>
        </>
      )}

      <div className="h-16" />
    </div>
  )
}
