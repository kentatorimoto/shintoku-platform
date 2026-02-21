import fs from "fs"
import path from "path"
import Link from "next/link"

interface TimelineEvent {
  date: string
  label: string
}

async function getTimeline(): Promise<TimelineEvent[]> {
  try {
    const filePath = path.join(process.cwd(), "data", "process.json")
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    return data.timeline
  } catch (error) {
    console.error("Failed to load timeline:", error)
    return []
  }
}

export default async function TimelinePage() {
  const timeline = await getTimeline()

  return (
    <div className="pageWrap">
      <header className="pageHeader">
        <Link href="/process" className="backLink">
          ← 意思決定プロセスに戻る
        </Link>
        <h1 className="pageTitle">意思決定タイムライン</h1>
        <p className="pageDesc">計画策定・議論・判断の節目を時系列で整理</p>
      </header>

      <div className="card">
        <div className="text-textSub text-xs">MILESTONES</div>
        <div className="mt-2 text-2xl font-semibold">{timeline.length}</div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg md:text-xl font-semibold">タイムライン</h2>

        <div className="mt-4 space-y-4">
          {timeline.map((event, index) => (
            <div key={index} className="flex gap-4">
              {/* left rail */}
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-accent mt-3" />
                {index < timeline.length - 1 && (
                  <div className="w-px flex-1 bg-line mt-2" />
                )}
              </div>

              {/* card */}
              <div className="card flex-1">
                <div className="text-xs text-textSub">{event.date}</div>
                <div className="mt-2 text-textMain font-semibold">
                  {event.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}