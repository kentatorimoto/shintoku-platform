import fs from "fs"
import path from "path"
import Link from "next/link"

interface Announcement {
  title: string
  date: string
  category: string
  url: string
  isNew?: boolean
}

async function getAnnouncements(): Promise<Announcement[]> {
  try {
    const dataDir = path.join(process.cwd(), "data", "scraped")
    const files = fs.readdirSync(dataDir)

    const latestFile = files
      .filter((f) => f.startsWith("announcements-") && f.endsWith(".json"))
      .sort()
      .reverse()[0]

    if (!latestFile) return []

    const filePath = path.join(dataDir, latestFile)
    const fileContent = fs.readFileSync(filePath, "utf-8")
    return JSON.parse(fileContent)
  } catch (error) {
    console.error("Failed to load announcements:", error)
    return []
  }
}

export default async function AnnouncementsPage() {
  const announcements = await getAnnouncements()
  const total = announcements.length
  const newCount = announcements.filter((a) => a.isNew).length

  return (
    <div className="pageWrap">
      <header className="pageHeader">
        <Link href="/" className="backLink">
          ← トップに戻る
        </Link>

        <h1 className="pageTitle">町政ニュース</h1>
        <p className="pageDesc">
          新得町公式サイトから自動収集（全{total}件 / NEW {newCount}件）
        </p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="card">
          <div className="text-textSub text-sm">TOTAL</div>
          <div className="mt-2 text-2xl font-semibold text-textMain">{total}件</div>
        </div>
        <div className="card">
          <div className="text-textSub text-sm">NEW</div>
          <div className="mt-2 text-2xl font-semibold text-textMain">{newCount}件</div>
        </div>
        <div className="card">
          <div className="text-textSub text-sm">SOURCE</div>
          <div className="mt-2 text-base font-semibold text-textMain">shintoku-town.jp</div>
        </div>
      </section>

      {/* List */}
      <section className="space-y-4 pb-16">
        {total === 0 ? (
          <div className="card">
            <p className="text-textMain font-semibold">データがありません</p>
            <p className="mt-2 text-textSub text-sm">
              スクレイピングスクリプトを実行して JSON を生成してください。
            </p>
          </div>
        ) : (
          announcements.map((a, idx) => (
            <div key={idx} className="card cardHover">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.isNew && (
                      <span className="chip chipActive">NEW</span>
                    )}
                    {a.category && (
                      <span className="text-textSub text-sm">[{a.category}]</span>
                    )}
                  </div>

                  <h3 className="mt-3 text-lg md:text-xl font-semibold text-textMain">
                    {a.title || "（タイトルなし）"}
                  </h3>

                  <div className="mt-2 text-textSub text-sm">
                    {a.date || "日付不明"}
                  </div>
                </div>

                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btnSecondary px-4 py-2 text-sm shrink-0"
                >
                  詳細 →
                </a>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}