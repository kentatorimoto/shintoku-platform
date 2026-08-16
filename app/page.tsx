import fs from "fs"
import path from "path"
import Link from "next/link"
import PlateFrame from "@/components/PlateFrame"
import { LABELS } from "@/lib/labels"

// gikai_sessions.json はビルド時に sortDate??date 降順で書き出される。
// 配列先頭が最新、配列順がそのまま表示順（SHEET番号）になる。
interface GikaiSession {
  id:              string
  narrativeTitle?: string
  officialTitle:   string
  date:            string
  tags:            string[]
  parts:           { label: string }[]
}

interface GiketsuSession {
  items: unknown[]
}

const MEETING_TAGS = ["定例会", "臨時会", "特別委員会"]

function getSessions(): GikaiSession[] {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as GikaiSession[]
  } catch {
    return []
  }
}

function getGiketsuCount(): number {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "giketsu_index.json")
    return (JSON.parse(fs.readFileSync(filePath, "utf-8")) as GiketsuSession[])
      .reduce((sum, s) => sum + s.items.length, 0)
  } catch {
    return 0
  }
}

// ── 導出ヘルパ ───────────────────────────────────────────────────────────────

function extractDateFromLabel(label: string, sessionDate: string): string {
  const match = label.match(/[（(](\d{1,2})\/(\d{1,2})[）)]/)
  if (!match) return sessionDate
  const year  = sessionDate.slice(0, 4)
  const month = match[1].padStart(2, "0")
  const day   = match[2].padStart(2, "0")
  return `${year}-${month}-${day}`
}

const toDot = (iso: string) => iso.replace(/-/g, ".")

/** 会期の日付範囲。単日なら "2026.06.19"、複数日なら "2026.06.03 — 06.19（会期17日間）"。 */
function dateRangeDisplay(session: GikaiSession): string {
  const dates = session.parts.map(p => extractDateFromLabel(p.label, session.date)).sort()
  const start = dates[0] ?? session.date
  const end   = dates[dates.length - 1] ?? session.date
  if (start === end) return toDot(start)

  const spanDays =
    Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
  const endShort = toDot(end).slice(5) // "06.19"
  return `${toDot(start)} — ${endShort}（会期${spanDays}日間）`
}

const meetingTag = (tags: string[]) => tags.find(t => MEETING_TAGS.includes(t)) ?? ""

// ── UI 断片 ──────────────────────────────────────────────────────────────────

function IndexRow({ href, num, label, desc }: { href: string; num: string; label: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group grid grid-cols-[76px_1fr_auto] md:grid-cols-[110px_1fr_auto] items-baseline gap-3 md:gap-5
                 py-5 px-1 border-b border-line rounded-[3px] transition-colors hover:bg-hover"
    >
      <span className="mono font-bold text-2xl md:text-[30px] leading-none">{num}</span>
      <span className="text-[15px] font-bold">
        {label}
        <span className="block md:inline text-textSub font-normal text-[12.5px] md:ml-3.5">{desc}</span>
      </span>
      <span className="mono text-textSub transition-colors group-hover:text-accent">→</span>
    </Link>
  )
}

// ── ページ ───────────────────────────────────────────────────────────────────

export default function Home() {
  const sessions     = getSessions()
  const giketsuCount = getGiketsuCount()
  const total        = sessions.length
  const latest       = sessions[0]

  return (
    <div className="max-w-[1040px] mx-auto px-6">

      {/* ── 図版：最新の記録 ─────────────────────────────────────────── */}
      {latest && (
        <div className="pt-11">
          <PlateFrame className="pt-10 px-6 pb-9 md:px-11">
            <div className="flex justify-between items-baseline text-xs text-textSub mb-6">
              <span className="text-accent font-bold flex items-center gap-2">
                <span className="inline-block w-[7px] h-[7px] rounded-full bg-accent" aria-hidden />
                最新の記録
              </span>
              <span className="mono text-[11px] tracking-[0.1em]">SHEET {total} / {total}</span>
            </div>

            <p className="mono text-[13px] text-textSub mb-2.5">{dateRangeDisplay(latest)}</p>

            <h1
              className="font-mincho font-bold leading-[1.35] mb-2.5 text-textMain"
              style={{ fontSize: "clamp(28px, 4.6vw, 44px)" }}
            >
              {latest.narrativeTitle ?? latest.officialTitle}
            </h1>

            <p className="text-[13px] text-textSub mb-5">{latest.officialTitle}</p>

            <div className="flex flex-wrap gap-2 mb-7">
              {latest.tags.map(tag => (
                <span
                  key={tag}
                  className="text-[11.5px] font-medium text-textSub border border-lineStrong rounded-[3px] px-[11px] py-[3px]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <Link
              href={`/gikai/sessions/${latest.id}`}
              className="group inline-block text-sm font-bold border-b-2 border-textMain pb-[3px]
                         transition-colors hover:text-accent hover:border-accent"
            >
              この会期を読む
            </Link>
          </PlateFrame>

          {/* 機能文 */}
          <div className="flex flex-wrap justify-between gap-3 pt-[26px] text-[13.5px] text-textSub">
            <span>新得町議会の記録を、構造のまま公開しています。非公式・個人プロジェクト。</span>
            <span className="mono text-[11px] tracking-[0.08em]">43°04′N 142°50′E</span>
          </div>
        </div>
      )}

      {/* ── 索引 ─────────────────────────────────────────────────────── */}
      <section className="mt-[52px] border-t-[1.5px] border-textMain">
        <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textSub pt-4 pb-1.5">索引</h2>
        <IndexRow href="/gikai/sessions" num={String(total)}       label="会議" desc="令和6年からの全会期の記録" />
        <IndexRow href="/gikai"          num={giketsuCount.toLocaleString()} label="議決" desc="町が選んだことの一覧" />
        <IndexRow
          href="/process"
          num="6"
          label={LABELS.continuingIssues.text}
          desc={`${LABELS.continuingIssues.formal} — 複数の会議をまたいで続く議論`}
        />
      </section>

      {/* ── 近時の記録 ───────────────────────────────────────────────── */}
      <section className="mt-[52px] border-t-[1.5px] border-textMain">
        <div className="flex items-baseline justify-between pt-4 pb-1.5">
          <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textSub">近時の記録</h2>
          <Link href="/gikai/sessions" className="text-[12.5px] text-textSub transition-colors hover:text-accent">
            すべての記録 →
          </Link>
        </div>
        {sessions.slice(0, 4).map((s, i) => (
          <Link
            key={s.id}
            href={`/gikai/sessions/${s.id}`}
            className="group grid grid-cols-[52px_1fr_auto] md:grid-cols-[72px_92px_1fr_auto] items-baseline
                       gap-3 md:gap-5 py-4 px-1 border-b border-line rounded-[3px] transition-colors hover:bg-hover"
          >
            <span className="mono text-textSub text-[13px]">NO.{total - i}</span>
            <span className="mono text-textSub text-[13px] hidden md:block">{toDot(s.date)}</span>
            <span className="text-[14px] font-bold leading-snug">
              {s.narrativeTitle ?? s.officialTitle}
              <span className="mono block md:hidden text-textSub text-[11px] font-normal mt-0.5">{toDot(s.date)}</span>
            </span>
            <span className="text-[11px] text-textSub border border-lineStrong rounded-[3px] px-2 py-[2px] whitespace-nowrap justify-self-end">
              {meetingTag(s.tags)}
            </span>
          </Link>
        ))}
      </section>

      <div className="h-16" />
    </div>
  )
}
