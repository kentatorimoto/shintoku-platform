import fs from "fs"
import path from "path"
import Link from "next/link"

interface GikaiSession {
  id:              string
  narrativeTitle?: string
  officialTitle:   string
  date:            string
  parts:           { label: string }[]
}

interface GiketsuSession {
  items: unknown[]
}

interface LatestInfo {
  session:   GikaiSession
  partIndex: number
  partLabel: string
  partDate:  string
}

function extractDateFromLabel(label: string, sessionDate: string): string {
  const match = label.match(/[（(](\d{1,2})\/(\d{1,2})[）)]/)
  if (!match) return sessionDate
  const year = new Date(sessionDate).getFullYear()
  const month = match[1].padStart(2, "0")
  const day   = match[2].padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getLatestInfo(): LatestInfo | null {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    const sessions = JSON.parse(fs.readFileSync(filePath, "utf-8")) as GikaiSession[]
    const session = sessions.sort((a, b) => b.date.localeCompare(a.date))[0]
    if (!session) return null
    const partIndex = session.parts.length - 1
    const lastPart  = session.parts[partIndex]
    return {
      session,
      partIndex,
      partLabel: lastPart.label,
      partDate:  extractDateFromLabel(lastPart.label, session.date),
    }
  } catch {
    return null
  }
}

function getStats(): { sessionCount: number; giketsuCount: number } {
  try {
    const sessionsPath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    const sessionCount = (JSON.parse(fs.readFileSync(sessionsPath, "utf-8")) as GikaiSession[]).length

    const giketsuPath = path.join(process.cwd(), "public", "data", "giketsu_index.json")
    const giketsuCount = (JSON.parse(fs.readFileSync(giketsuPath, "utf-8")) as GiketsuSession[])
      .reduce((sum, s) => sum + s.items.length, 0)

    return { sessionCount, giketsuCount }
  } catch {
    return { sessionCount: 0, giketsuCount: 0 }
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
}

export default function Home() {
  const latestInfo = getLatestInfo()
  const { sessionCount, giketsuCount } = getStats()

  return (
    <main className="bg-base text-textMain font-sans px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
<section className="max-w-3xl pt-6 pb-8 mb-8">
  <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight break-keep">
    町を読む。
  </h2>

  <p className="text-textMain/60 text-base mt-4 leading-relaxed">
    ニュースではなく、流れを見る。<br />
    断片ではなく、構造を見る。
  </p>

  <div className="grid grid-cols-3 gap-px bg-line/30 rounded-xl overflow-hidden mt-8 mb-6">
    <div className="bg-base flex flex-col items-center py-4">
      <p className="text-2xl font-bold text-textMain">{sessionCount}</p>
      <p className="text-[10px] text-textSub/50 mt-1">会議</p>
    </div>
    <div className="bg-base flex flex-col items-center py-4 border-x border-line/30">
      <p className="text-2xl font-bold text-textMain">{giketsuCount.toLocaleString()}</p>
      <p className="text-[10px] text-textSub/50 mt-1">議決</p>
    </div>
    <div className="bg-base flex flex-col items-center py-4">
      <p className="text-2xl font-bold text-textMain">6</p>
      <p className="text-[10px] text-textSub/50 mt-1">継続論点</p>
    </div>
  </div>

  {latestInfo && (
    <Link
      href={`/gikai/sessions/${latestInfo.session.id}/${latestInfo.partIndex}`}
      className="border border-line rounded-xl p-4 flex items-start justify-between gap-3 hover:border-accent/50 transition bg-ink block"
    >
      <div className="min-w-0">
        <p className="text-[10px] text-textSub/50 tracking-widest uppercase mb-1">
          最新 — {formatDate(latestInfo.partDate)}
        </p>
        <p className="text-sm font-medium text-textMain leading-snug mb-1">
          {latestInfo.session.narrativeTitle ?? latestInfo.session.officialTitle}
        </p>
        <p className="text-xs text-accent/70">{latestInfo.partLabel}</p>
      </div>
      <svg className="w-4 h-4 text-textSub/30 shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </Link>
  )}
</section>

       {/* Modules */}
<section>
  <div className="grid grid-cols-2 gap-3">
    <Link
      href="/gikai/sessions"
      className="bg-ink border border-line rounded-xl p-4 hover:border-accent transition-all"
    >
      <h3 className="text-sm font-semibold mb-1">議会を読む</h3>
      <p className="text-xs text-textSub/60 leading-relaxed">会議の記録から議論をたどる</p>
    </Link>

    <Link
      href="/gikai"
      className="bg-ink border border-line rounded-xl p-4 hover:border-accent transition-all"
    >
      <h3 className="text-sm font-semibold mb-1">決まったこと</h3>
      <p className="text-xs text-textSub/60 leading-relaxed">町が選んだこと</p>
    </Link>

    <Link
      href="/process"
      className="bg-ink border border-line rounded-xl p-4 hover:border-accent transition-all"
    >
      <h3 className="text-sm font-semibold mb-1">流れを読む</h3>
      <p className="text-xs text-textSub/60 leading-relaxed">意思決定の構造</p>
    </Link>

  </div>
</section>
      </div>
    </main>
  )
}