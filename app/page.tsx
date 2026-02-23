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
    <main className="min-h-screen bg-base text-textMain font-sans p-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
<section className="max-w-3xl py-20 md:py-36 mb-16">
  <h2 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight break-keep">
  町を、読む。
</h2>

  <p className="text-textMain/70 text-lg md:text-xl mt-6 leading-relaxed">
    ニュースではなく、流れを見る。<br />
    断片ではなく、構造を見る。
  </p>

  {latest && (
    <div className="mt-8 border-l-2 border-accent pl-4">
      <p className="text-xs text-textSub/60 tracking-widest uppercase mb-1">最新の会議</p>
      <p className="text-sm text-textSub/80">{formatDate(latest.date)}</p>
      <p className="text-base text-textMain font-medium mt-0.5">
        {latest.narrativeTitle ?? latest.officialTitle}
      </p>
      <Link href={`/gikai/sessions/${latest.id}`} className="text-xs text-accent mt-2 inline-block">
        → 会議を読む
      </Link>
    </div>
  )}

  <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
    <Link
      href="/gikai/sessions"
      className="inline-flex items-center justify-center w-full md:w-auto bg-accent text-base font-semibold px-7 py-4 md:py-3 rounded-xl hover:bg-accentSoft transition-colors"
    >
      町議会を読む →
    </Link>
  </div>
</section>

       {/* Modules */}
<section>
  <h2 className="text-2xl font-bold mb-6">ACTIVE MODULES</h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

    {/* 1. 町議会を読む */}
    <Link
      href="/gikai/sessions"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">町議会を読む</h3>
      <p className="text-textSub mb-4">
        議決結果・会議アーカイブ・論点を読む
      </p>
      <div className="text-sm text-accent font-medium">
        → 議会を読む
      </div>
    </Link>

    {/* 2. 分析・意思決定プロセス */}
    <Link
      href="/insights"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">分析・意思決定プロセス</h3>
      <p className="text-textSub mb-4">
        議決データの可視化と、意思決定の流れを読む
      </p>
      <div className="text-sm text-accent font-medium">
        → データを読む
      </div>
    </Link>

    {/* 3. 町政ニュース */}
    <Link
      href="/announcements"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">町政ニュース</h3>
      <p className="text-textSub mb-4">
        新得町の最新お知らせを自動収集・検索
      </p>
      <div className="text-sm text-accent font-medium">
        → 最新を見る
      </div>
    </Link>

    {/* 4. 広報しんとくアーカイブ */}
    <Link
      href="/newsletters"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">
        広報しんとくアーカイブ
      </h3>
      <p className="text-textSub mb-4">
        広報誌PDF検索・全文検索
      </p>
      <div className="text-sm text-accent font-medium">
        → 記事を探す
      </div>
    </Link>

    {/* 5. 地形マップ */}
    <Link
      href="/map"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">
        地形マップ
        <span className="text-[10px] font-semibold tracking-widest text-textSub/50 border border-textSub/30 rounded px-1.5 py-0.5 ml-2">
          実験中
        </span>
      </h3>
      <p className="text-textSub mb-4">
        流域・地形・歴史を重ねて読む
      </p>
      <div className="text-sm text-accent font-medium">
        → マップを見る
      </div>
    </Link>

  </div>
</section>
      </div>
    </main>
  )
}