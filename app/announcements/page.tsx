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

function formatDate(raw: string) {
  // 既に整ってるならそのまま
  return raw || "日付不明"
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
          新得町公式サイトから自動収集（全{total}件）
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-textSub text-xs">TOTAL</div>
          <div className="mt-2 text-2xl font-semibold">{total}</div>
        </div>
        <div className="card">
          <div className="text-textSub text-xs">NEW</div>
          <div className="mt-2 text-2xl font-semibold">{newCount}</div>
        </div>
        <div className="card">
          <div className="text-textSub text-xs">SOURCE</div>
          <div className="mt-2 text-base text-textMain">shintoku-town.jp</div>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg md:text-xl font-semibold">一覧</h2>
          <div className="text-sm text-textSub">
            最新データ：announcements-*.json
          </div>
        </div>

        {announcements.length === 0 ? (
          <div className="card mt-4">
            <p className="text-textMain font-semibold">データがありません</p>
            <p className="text-textSub mt-2 text-sm">
              スクレイピングスクリプトの実行を確認してください。
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {announcements.map((a, idx) => (
              <div key={idx} className="card cardHover">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.isNew && (
                        <span className="inline-flex items-center rounded-full bg-accent text-base px-2.5 py-1 text-xs font-semibold">
                          NEW
                        </span>
                      )}
                      {a.category && (
                        <span className="inline-flex items-center rounded-full border border-line px-2.5 py-1 text-xs text-textSub">
                          {a.category}
                        </span>
                      )}
                      <span className="text-xs text-textSub">
                        {formatDate(a.date)}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base md:text-lg font-semibold text-textMain break-words">
                      {a.title || "（タイトルなし）"}
                    </h3>
                  </div>

                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm text-accent hover:text-accentSoft transition"
                  >
                    詳細 →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}