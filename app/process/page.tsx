import type { Metadata } from "next"
import Link from "next/link"
import PlateFrame from "@/components/PlateFrame"
import { ISSUES, computeSpan, isHot } from "./issuesData"

export const metadata: Metadata = {
  title: "流れを読む | Shintoku Atlas",
  description: "ひとつの論点が、複数の会議をどう渡っていったか。日付順の裏にある構造を図として記録しています。",
}

const toDot = (iso: string) => iso.replace(/-/g, ".")
const formatMonth = (iso: string) => iso.slice(0, 7).replace("-", ".")

// トレース図でフィーチャーする論点（最も会期数の多いもの）
const featured = [...ISSUES].sort((a, b) => b.sessions.length - a.sessions.length)[0]

export default function ProcessPage() {
  // 横軸の右端＝現在。sortDate 事故を避けるため new Date() は使わず固定の月初を基準にする。
  const axisEnd = Date.parse("2026-07-01")
  const featIdx = ISSUES.findIndex(i => i.id === featured.id) + 1
  const featStart = featured.sessions[0].date
  const featEnd   = featured.sessions[featured.sessions.length - 1].date

  return (
    <div className="max-w-[1040px] mx-auto px-6">

      {/* ── 見出し ───────────────────────────────────────────────────── */}
      <div className="pt-12 pb-2">
        <p className="text-[12px] font-bold tracking-[0.14em] text-accent mb-3">意思決定の構造図</p>
        <h1 className="font-mincho font-bold leading-[1.4] text-textMain" style={{ fontSize: "clamp(26px, 4vw, 38px)" }}>
          流れを読む
        </h1>
        <p className="text-[13.5px] text-textSub mt-2.5 max-w-[560px]">
          ひとつの論点が、複数の会議をどう渡っていったか。日付順の裏にある構造を図として記録しています。
        </p>
      </div>

      {/* ── トレース図 ───────────────────────────────────────────────── */}
      <div className="mt-11">
        <PlateFrame className="px-6 py-8 md:px-10">
          <div className="flex justify-between text-[11.5px] text-textSub mb-2">
            <span className="mono tracking-[0.1em]">
              ISSUE TRACE — NO.{String(featIdx).padStart(2, "0")}
            </span>
            <span>{formatMonth(featStart)} — {isHot(featured.status) ? "継続中" : formatMonth(featEnd)}</span>
          </div>
          <h2 className="font-mincho text-[22px] font-bold text-textMain mb-1">{featured.title}</h2>
          <p className="text-[12.5px] text-textSub mb-7">{featured.summary}</p>

          <div className="relative pl-[18px]">
            <span className="absolute left-[5px] top-2 bottom-2 w-[1.5px] bg-textSub" aria-hidden />
            {featured.sessions.map((s, i) => {
              const last = i === featured.sessions.length - 1
              const now  = last && isHot(featured.status)
              return (
                <div key={s.sessionId} className={`relative pl-[22px] ${last ? "" : "pb-6"}`}>
                  <span
                    className={`absolute left-[-18px] top-[9px] w-[11px] h-[11px] rounded-full border-[1.5px] ${
                      now ? "bg-accent border-accent" : "bg-base border-textSub"
                    }`}
                    aria-hidden
                  />
                  <div className="mono text-[12px] text-textSub">{toDot(s.date)}</div>
                  <div className={`text-[14.5px] font-bold mt-0.5 ${now ? "text-accent" : "text-textMain"}`}>{s.title}</div>
                  <div className="text-[13px] text-textSub mt-0.5 max-w-[640px]">{s.conflict}</div>
                  <Link href={`/gikai/sessions/${s.sessionId}`} className="text-[12px] text-accent font-bold hover:opacity-70 transition-opacity">
                    会議を読む →
                  </Link>
                </div>
              )
            })}
          </div>
        </PlateFrame>
      </div>

      {/* ── 論点の索引 ───────────────────────────────────────────────── */}
      <section className="mt-14 border-t-[1.5px] border-textMain">
        <div className="flex items-baseline justify-between pt-4 pb-1.5">
          <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textSub">継続論点の索引 — {ISSUES.length}件</h2>
          <Link href="/process/issues" className="text-[12.5px] text-textSub hover:text-accent transition-colors">論点カード →</Link>
        </div>

        {ISSUES.map((issue) => {
          const span = computeSpan(issue, axisEnd)
          const hot  = isHot(issue.status)
          const href = issue.detailHref ?? `/process/timeline?tag=${encodeURIComponent(issue.timelineTag)}`
          return (
            <Link
              key={issue.id}
              href={href}
              className="group grid grid-cols-[1fr_auto] md:grid-cols-[1fr_210px_auto] items-center gap-3 md:gap-5
                         py-[18px] px-1 border-b border-line rounded-[3px] transition-colors hover:bg-hover"
            >
              <span className="text-[15px] font-bold min-w-0">
                {issue.title}
                <span className="block text-[12px] text-textSub font-normal mt-0.5">{issue.lede}</span>
              </span>

              <span className="relative h-[22px] hidden md:block">
                <span className="absolute left-0 right-0 top-[10px] h-px bg-lineStrong" aria-hidden />
                <span
                  className={`absolute top-2 h-[5px] rounded-[2px] ${hot ? "bg-accent" : "bg-textSub"}`}
                  style={{ left: `${span.leftPct}%`, width: `${span.widthPct}%` }}
                  aria-hidden
                />
              </span>

              <span className="mono text-[11.5px] text-textSub text-right whitespace-nowrap justify-self-end">
                {issue.sessions.length}会期 ｜ {issue.status}
              </span>
            </Link>
          )
        })}

        <div className="flex flex-wrap gap-5 text-[11px] text-textSub pt-3 px-1">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-1 rounded-[2px] bg-accent" />継続中</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-1 rounded-[2px] bg-textSub" />一区切り</span>
          <span>横軸 — 2024.06 → 現在</span>
        </div>
      </section>

      {/* ── 関連ページ（サブページへの導線を残す）─────────────────────── */}
      <section className="mt-14 border-t-[1.5px] border-textMain">
        <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textSub pt-4 pb-1.5">関連</h2>
        {[
          { href: "/process/timeline",   label: "意思決定タイムライン", desc: "計画策定の節目と流れ" },
          { href: "/process/priorities", label: "重点テーマ",         desc: "政策議論の焦点・優先度" },
          { href: "/insights",           label: "データで見る",       desc: "会議・議決の集計" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group flex items-baseline justify-between gap-4 py-4 px-1 border-b border-line rounded-[3px] transition-colors hover:bg-hover"
          >
            <span className="text-[15px] font-bold">
              {l.label}
              <span className="text-textSub font-normal text-[12.5px] ml-3">{l.desc}</span>
            </span>
            <span className="mono text-textSub transition-colors group-hover:text-accent">→</span>
          </Link>
        ))}
      </section>

      <div className="h-16" />
    </div>
  )
}
