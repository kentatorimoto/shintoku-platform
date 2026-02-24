import fs from "fs"
import path from "path"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "重点テーマ | Shintoku Atlas",
  description: "町が掲げる目標と、議会で実際に議論されていること",
}

// ── 型定義 ─────────────────────────────────────────────────────────────────
interface Summary {
  issues:      string
  conflicts:   string
  nextActions: string
}

interface GikaiSession {
  id:              string
  officialTitle:   string
  narrativeTitle?: string
  date:            string
  tags:            string[]
  summary?:        Summary
}

// ── 静的データ：第9期総合計画 5つの基本目標 ────────────────────────────
const OFFICIAL_PRIORITIES = [
  {
    goal: "協働",
    desc: "人口減少対策・移住定住・財政健全化",
    tags: ["人口政策", "財政", "総合計画"],
  },
  {
    goal: "保健福祉",
    desc: "子育て・高齢者・医療・福祉",
    tags: ["子育て", "福祉"],
  },
  {
    goal: "教育・文化",
    desc: "子どもの育成・生涯学習・文化",
    tags: ["教育", "文化"],
  },
  {
    goal: "産業",
    desc: "農林業・観光・6次産業化・駅前活性化",
    tags: ["農業", "観光"],
  },
  {
    goal: "生活環境",
    desc: "インフラ・交通・防災・エネルギー",
    tags: ["インフラ", "エネルギー"],
  },
] as const

// ── データ読み込み ──────────────────────────────────────────────────────────
function getSessions(): GikaiSession[] {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as GikaiSession[]
  } catch {
    return []
  }
}

// ── 日付フォーマット ────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
}

// ──────────────────────────────────────────────────────────────────────────────

export default function PrioritiesPage() {
  const sessions = getSessions()

  // ── セクション1：基本目標ごとの集計 ──────────────────────────────────
  const priorityStats = OFFICIAL_PRIORITIES.map((p) => {
    const matched = sessions.filter((s) =>
      p.tags.some((tag) => s.tags.includes(tag))
    )
    // 日付降順で最新を取得
    const latest = matched.sort((a, b) => b.date.localeCompare(a.date))[0]
    return { ...p, count: matched.length, latest }
  })

  // ── セクション2：「争点あり」タグの会議から conflicts を抽出 ─────────
  const disputeSessions = sessions
    .filter((s) => s.tags.includes("争点あり") && s.summary?.conflicts)
    .sort((a, b) => b.date.localeCompare(a.date))

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
          重点テーマ
        </h1>
        <p className="text-textMain/70 text-lg">
          町が掲げる目標と、議会で実際に議論されていること
        </p>
      </div>

      {/* ── セクション1：重点テーマ対照表 ─────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-xs font-semibold text-textSub tracking-widest mb-4">
          第9期総合計画 基本目標 × 議会での議論
        </h2>
        <div className="space-y-3">
          {priorityStats.map((p) => (
            <div
              key={p.goal}
              className="bg-ink border border-line rounded-xl p-5
                         hover:border-accent/50 transition-all"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* 左：公式目標 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-accent/80 tracking-wide">
                      【{p.goal}】
                    </span>
                    <span className="text-sm text-textSub">{p.desc}</span>
                  </div>
                  {p.latest ? (
                    <p className="text-sm text-textMain/70 mt-1 leading-snug">
                      {p.latest.narrativeTitle ?? p.latest.officialTitle}
                      {p.count > 1 && (
                        <span className="text-textSub/50 ml-1">
                          ほか {p.count - 1} 件
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-textSub/40 mt-1 italic">記録なし</p>
                  )}
                </div>

                {/* 右：件数＋タイムラインリンク */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs text-textSub">
                    議論：<span className="text-textMain font-semibold">{p.count}</span> 件
                  </span>
                  {p.count > 0 && (
                    <Link
                      href={`/process/timeline?tag=${encodeURIComponent(p.tags[0])}`}
                      className="text-xs text-accent hover:text-accent/70 transition-colors whitespace-nowrap"
                    >
                      → タイムラインで見る
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-textSub/50 mt-3">
          ※ 出典：新得町第9期総合計画（R8〜R17）。議論件数は会議アーカイブに基づく。
        </p>
      </section>

      {/* ── セクション2：議会で浮上している未解決の争点 ─────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-textSub tracking-widest mb-4">
          議会で浮上している未解決の争点
        </h2>

        {disputeSessions.length === 0 ? (
          <p className="text-textSub text-center py-12">
            争点データがありません
          </p>
        ) : (
          <div className="space-y-3">
            {disputeSessions.map((session) => (
              <div
                key={session.id}
                className="bg-ink border border-line rounded-xl p-5"
              >
                {/* 会議情報 */}
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <p className="text-xs text-accent font-semibold tracking-wide mb-0.5">
                      {formatDate(session.date)}
                    </p>
                    <p className="text-sm font-medium text-textMain leading-snug">
                      {session.narrativeTitle ?? session.officialTitle}
                    </p>
                  </div>
                  <Link
                    href={`/gikai/sessions/${session.id}`}
                    className="text-xs text-accent hover:text-accent/70 transition-colors shrink-0 whitespace-nowrap"
                  >
                    会議を読む →
                  </Link>
                </div>
                {/* 争点本文 */}
                <div className="flex gap-1.5 items-baseline">
                  <span className="text-[11px] text-textSub/50 whitespace-nowrap shrink-0">
                    争点：
                  </span>
                  <p className="text-sm leading-relaxed text-textMain/80">
                    {session.summary!.conflicts}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
