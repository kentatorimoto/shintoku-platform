import fs from "fs"
import path from "path"
import Link from "next/link"

interface Priority {
  id: string
  title: string
  bullets: string[]
}

async function getPriorities(): Promise<Priority[]> {
  try {
    const filePath = path.join(process.cwd(), "data", "process.json")
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    return data.priorities ?? []
  } catch (error) {
    console.error("Failed to load priorities:", error)
    return []
  }
}

export default async function PrioritiesPage() {
  const priorities = await getPriorities()

  return (
    <div className="pageWrap">
      <header className="pageHeader">
        <Link href="/process" className="backLink">
          ← 意思決定プロセスに戻る
        </Link>

        <h1 className="pageTitle">重点テーマ</h1>
        <p className="pageDesc">町の政策議論の焦点・優先度を整理</p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <div className="card">
          <div className="text-textSub text-sm">CATEGORIES</div>
          <div className="mt-2 text-2xl font-semibold text-textMain">
            {priorities.length}
          </div>
        </div>
        <div className="card">
          <div className="text-textSub text-sm">STATUS</div>
          <div className="mt-2 text-2xl font-semibold text-textMain">
            Under review
          </div>
          <div className="mt-2 text-sm text-textSub">
            ※表示は仮。後で「更新日」や「根拠資料」などに差し替え可
          </div>
        </div>
      </section>

      {/* List */}
      <section className="space-y-4 pb-16">
        {priorities.map((priority) => (
          <div key={priority.id} className="card">
            <h2 className="text-xl font-semibold text-textMain">
              {priority.title}
            </h2>

            <ul className="mt-4 space-y-2 text-textSub">
              {priority.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-accent shrink-0 leading-6">→</span>
                  <span className="leading-6">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Source note */}
        <div className="card">
          <div className="text-textSub text-sm">
            Sources: Internal document highlights (unofficial) / Public documents
          </div>
        </div>
      </section>
    </div>
  )
}