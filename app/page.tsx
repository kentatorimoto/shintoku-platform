import fs from "fs"
import path from "path"
import Link from "next/link"

interface GikaiSession {
  id:             string
  narrativeTitle?: string
  officialTitle:  string
  date:           string
}

function getLatestSession(): GikaiSession | null {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    const sessions = JSON.parse(fs.readFileSync(filePath, "utf-8")) as GikaiSession[]
    return sessions.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  } catch {
    return null
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
}

export default function Home() {
  const latest = getLatestSession()

  return (
    <main className="bg-base text-textMain font-sans px-8 pb-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
<section className="max-w-3xl pt-8 pb-12 mb-16">
  <h2 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight break-keep">
  町を、読む。
</h2>

  <p className="text-textMain/70 text-lg md:text-xl mt-6 leading-relaxed">
    ニュースではなく、流れを見る。<br />
    断片ではなく、構造を見る。
  </p>

  {latest && (
    <Link
      href={`/gikai/sessions/${latest.id}`}
      className="mt-8 border-l-2 border-accent pl-4 block hover:opacity-80 transition"
    >
      <p className="text-xs text-textSub/60 tracking-widest uppercase mb-1">最新の会議</p>
      <p className="text-sm text-textSub/80">{formatDate(latest.date)}</p>
      <p className="text-base text-textMain font-medium mt-0.5">
        {latest.narrativeTitle ?? latest.officialTitle}
      </p>
    </Link>
  )}

</section>

       {/* Modules */}
<section>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

    {/* 1. 議会を読む */}
    <Link
      href="/gikai/sessions"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">議会を読む</h3>
      <p className="text-textSub">
        会議の記録から、町の議論をたどる。
      </p>
    </Link>

    {/* 2. 意思決定の流れを読む */}
    <Link
      href="/process"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">意思決定の流れを読む</h3>
      <p className="text-textSub">
        何がどう積み上がり、決まっていくのか。
      </p>
    </Link>

    {/* 3. 町の決定を読む */}
    <Link
      href="/gikai"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">町の決定を読む</h3>
      <p className="text-textSub">
        町が選んだこと、選ばなかったこと。
      </p>
    </Link>

    {/* 4. 地形を読む */}
    <Link
      href="/map"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">
        地形を読む
        <span className="text-[10px] font-semibold tracking-widest text-textSub/50 border border-textSub/30 rounded px-1.5 py-0.5 ml-2">
          実験中
        </span>
      </h3>
      <p className="text-textSub">
        流域・地形・歴史を重ねて見る。
      </p>
    </Link>

  </div>
</section>
      </div>
    </main>
  )
}