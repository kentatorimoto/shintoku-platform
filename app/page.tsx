import fs from "fs"
import path from "path"
import Link from "next/link"

async function getLastSync() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "lastSync.json")
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"))
    }
    return { date: "----.--.--" }
  } catch (e) {
    console.error("Failed to load lastSync:", e)
    return { date: "----.--.--" }
  }
}

export default async function Home() {
  const lastSync = await getLastSync()
  return (
    <main className="min-h-screen bg-base text-textMain font-sans p-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <section className="max-w-2xl py-16 md:py-32 mb-16 md:mb-24">
          <h2 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight">
            町を読む。
          </h2>
          <p className="text-textMain/70 text-lg md:text-xl mt-5 md:mt-6">
            公開情報から見える、新得町の現在地。
          </p>
          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <Link
              href="/announcements"
              className="inline-flex items-center justify-center w-full md:w-auto bg-accent text-base font-semibold px-6 py-4 md:py-3 rounded-xl hover:bg-accentSoft transition-colors"
            >
              町政ニュースを見る →
            </Link>
            <Link
              href="/newsletters"
              className="inline-flex items-center justify-center w-full md:w-auto border border-line text-textMain font-semibold px-6 py-4 md:py-3 rounded-xl hover:border-accent bg-transparent transition-colors"
            >
              広報誌を検索 →
            </Link>
          </div>
        </section>
      </div>

      {/* Quick Stats */}
      <div className="max-w-6xl mx-auto px-8 mb-24">
        <div className="flex gap-12 text-textSub">
          <div>
            <div className="text-textMain font-semibold text-xl">20+</div>
            <div className="text-sm">Data points</div>
          </div>
          <div>
            <div className="text-textMain font-semibold text-xl">39</div>
            <div className="text-sm">Newsletters</div>
          </div>
          <div>
            <div className="text-textMain font-semibold text-xl">Daily</div>
            <div className="text-sm">Auto sync</div>
          </div>
          <div>
            <div className="text-textMain font-semibold text-xl">Open</div>
            <div className="text-sm">Source</div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* ステータス */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all">
            <div className="text-textSub text-sm mb-1">STATUS</div>
            <div className="text-2xl">
              <span className="text-accent">●</span> OPERATIONAL
            </div>
          </div>
          <div className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all">
            <div className="text-textSub text-sm mb-1">DATA POINTS</div>
            <div className="text-2xl">20+</div>
          </div>
          <div className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all">
            <div className="text-textSub text-sm mb-1">LAST SYNC</div>
            <div className="text-2xl">{lastSync.date}</div>
          </div>
        </div>

        {/* モジュール */}
        <div>
          <h2 className="text-2xl font-bold mb-6">ACTIVE MODULES</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/announcements" className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all">
              <h3 className="text-xl font-semibold mb-2">町政ニュース</h3>
              <p className="text-textSub mb-4">新得町の最新お知らせを自動収集・検索</p>
              <div className="text-sm text-accent">
                → 一覧を見る
              </div>
            </Link>

            <Link href="/newsletters" className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all">
              <h3 className="text-xl font-semibold mb-2">広報しんとくアーカイブ</h3>
              <p className="text-textSub mb-4">広報誌PDF検索・全文検索</p>
              <div className="text-sm text-accent">
                → 一覧を見る
              </div>
            </Link>

            <Link href="/process" className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all">
              <h3 className="text-xl font-semibold mb-2">意思決定プロセス</h3>
              <p className="text-textSub mb-4">町の課題・議論・計画策定の流れを可視化</p>
              <div className="text-sm text-accent">
                → 一覧を見る
              </div>
            </Link>

            <div className="bg-ink border border-line rounded-xl p-6 opacity-40">
              <h3 className="text-xl font-semibold mb-2">イベントカレンダー</h3>
              <p className="text-textSub mb-4">町内イベント情報の統合表示</p>
              <div className="text-sm text-textSub">
                開発中 ...
              </div>
            </div>

            <Link href="/gikai" className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all">
              <h3 className="text-xl font-semibold mb-2">議会（議決結果）</h3>
              <p className="text-textSub mb-4">議決結果の検索・閲覧</p>
              <div className="text-sm text-accent">
                → 一覧を見る
              </div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
