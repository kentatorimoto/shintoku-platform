import fs from "fs"
import path from "path"
import Link from "next/link"

interface IssueSource {
  primary: {
    townPage: { title: string; url: string }
    youtube: { title: string; url: string; timestampSec?: number }
  }
  derived: {
    title: string
    note: string
    page?: number
  }
}

interface Issue {
  id: string
  theme: string
  title: string
  issue: string
  context: string
  admin_view: string
  next_step: string
  source: IssueSource
}

const THEME_LABELS: Record<string, string> = {
  agriculture: "農業・産業",
  tourism: "観光",
  finance: "財政",
}

function youtubeUrl(source: IssueSource): string {
  const yt = source.primary.youtube
  if (yt.timestampSec) return `${yt.url}&t=${yt.timestampSec}s`
  return yt.url
}

async function getIssues(): Promise<Issue[]> {
  try {
    const filePath = path.join(process.cwd(), "data", "process.json")
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    return data.issues
  } catch (error) {
    console.error("Failed to load issues:", error)
    return []
  }
}

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>
}) {
  const issues = await getIssues()
  const { theme: activeTheme } = await searchParams

  const themes = [...new Set(issues.map((i) => i.theme))]
  const filtered = activeTheme ? issues.filter((i) => i.theme === activeTheme) : issues

  return (
    <div className="pageWrap">
      <header className="pageHeader">
        <Link href="/process" className="backLink">
          ← 意思決定プロセスに戻る
        </Link>
        <h1 className="pageTitle">論点カード</h1>
        <p className="pageDesc">議論・判断・次の一手を、公開情報から要点抽出</p>
        <p className="mt-2 text-sm text-textSub">
          ※公式資料・議会中継等から要約を含みます（非公式）
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-textSub text-xs">TOTAL</div>
          <div className="mt-2 text-2xl font-semibold">{issues.length}</div>
        </div>
        <div className="card">
          <div className="text-textSub text-xs">THEMES</div>
          <div className="mt-2 text-2xl font-semibold">{themes.length}</div>
        </div>
        <div className="card">
          <div className="text-textSub text-xs">SHOWING</div>
          <div className="mt-2 text-2xl font-semibold">{filtered.length}</div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/process/issues"
          className={`chip ${!activeTheme ? "chipActive" : ""}`}
        >
          すべて
        </Link>
        {themes.map((t) => (
          <Link
            key={t}
            href={`/process/issues?theme=${t}`}
            className={`chip ${activeTheme === t ? "chipActive" : ""}`}
          >
            {THEME_LABELS[t] || t}
          </Link>
        ))}
        <div className="w-full text-xs text-textSub mt-2">
          フィルタ：{activeTheme ? (THEME_LABELS[activeTheme] || activeTheme) : "なし"}
        </div>
      </div>

      {/* List */}
      <section className="mt-8">
        <h2 className="text-lg md:text-xl font-semibold">一覧</h2>

        <div className="mt-4 space-y-4">
          {filtered.map((issue) => (
            <div key={issue.id} className="card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-line px-3 py-1 text-xs text-textSub">
                  {THEME_LABELS[issue.theme] || issue.theme}
                </span>
                <div className="text-textMain font-semibold text-base md:text-lg">
                  {issue.title}
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-textSub leading-relaxed">
                <div>
                  <span className="text-textMain font-semibold">論点：</span>
                  {issue.issue}
                </div>
                <div>
                  <span className="text-textMain font-semibold">背景：</span>
                  {issue.context}
                </div>
                {issue.admin_view && (
                  <div>
                    <span className="text-textMain font-semibold">行政の見解：</span>
                    {issue.admin_view}
                  </div>
                )}
                <div>
                  <span className="text-textMain font-semibold">次の一手：</span>
                  {issue.next_step}
                </div>

                {/* Sources */}
                <div className="pt-4 border-t border-line/40">
                  <div className="text-textMain font-semibold">出典</div>

                  <div className="mt-2">
                    <div className="text-xs text-textSub">一次情報</div>
                    <ul className="mt-1 space-y-1">
                      <li>
                        <a
                          href={issue.source.primary.townPage.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:text-accentSoft transition"
                        >
                          町ページ（議会・関連ページ） →
                        </a>
                      </li>
                      <li>
                        <a
                          href={youtubeUrl(issue.source)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:text-accentSoft transition"
                        >
                          YouTube（中継・委員会） →
                        </a>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs text-textSub">二次（編集メモ）</div>
                    <div className="mt-1">
                      {issue.source.derived.title}
                      {issue.source.derived.page != null && (
                        <span className="text-textSub">（p.{issue.source.derived.page}）</span>
                      )}
                    </div>
                    <div className="mt-2">
                      <Link
                        href="/sources"
                        className="text-accent hover:text-accentSoft transition text-sm"
                      >
                        Sources を見る →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 card">
        <div className="text-textSub text-sm">
          出典の全体は <Link href="/sources" className="text-accent hover:text-accentSoft transition">/sources</Link> にまとめています。
        </div>
      </div>
    </div>
  )
}