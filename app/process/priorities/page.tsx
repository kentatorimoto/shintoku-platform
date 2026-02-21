import fs from "fs"
import path from "path"
import Link from "next/link"

interface Priority {
  id: string
  title: string
  bullets: string[]
}

type GikaiLinks = Record<string, string[]>

async function getPriorities(): Promise<Priority[]> {
  try {
    const filePath = path.join(process.cwd(), "data", "process.json")
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    return data.priorities
  } catch (error) {
    console.error("Failed to load priorities:", error)
    return []
  }
}

async function getGikaiLinks(): Promise<GikaiLinks> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_links.json")
    return JSON.parse(fs.readFileSync(filePath, "utf-8"))
  } catch {
    return {}
  }
}

export default async function PrioritiesPage() {
  const [priorities, links] = await Promise.all([getPriorities(), getGikaiLinks()])

  const linkCounts = Object.fromEntries(
    priorities.map((p) => [
      p.id,
      Object.values(links).filter((refs) => refs.includes(`theme:${p.id}`)).length,
    ])
  )

  return (
    <div className="pageWrap">
      <header className="pageHeader">
        <Link href="/process" className="backLink">
          ← 意思決定プロセスに戻る
        </Link>
        <h1 className="pageTitle">政策の優先度</h1>
        <p className="pageDesc">町の政策議論の焦点・優先度を整理</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="text-textSub text-xs">CATEGORIES</div>
          <div className="mt-2 text-2xl font-semibold">{priorities.length}</div>
        </div>
        <div className="card">
          <div className="text-textSub text-xs">STATUS</div>
          <div className="mt-2 text-2xl font-semibold">整理中</div>
          <div className="mt-2 text-xs text-textSub">
            ※表示は仮。後で「更新日」「根拠資料」などに差し替え可
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg md:text-xl font-semibold">一覧</h2>

        <div className="mt-4 space-y-4">
          {priorities.map((p) => (
            <div key={p.id} className="card">
              <div className="text-textMain font-semibold text-lg">
                {p.title}
              </div>
              <ul className="mt-3 space-y-2 text-sm text-textSub">
                {p.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-accent shrink-0">→</span>
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
              {linkCounts[p.id] > 0 && (
                <Link
                  href={`/gikai?theme=${p.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-xs text-accent border border-line rounded px-3 py-1.5 hover:border-accent hover:bg-accent/5 transition-colors"
                >
                  関連議決: {linkCounts[p.id]}件 →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 card">
        <div className="text-textSub text-sm">
          出典：内部メモ（非公式）＋公開資料の要点
        </div>
      </div>
    </div>
  )
}
