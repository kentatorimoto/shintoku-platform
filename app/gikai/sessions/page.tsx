import fs from "fs"
import path from "path"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "町議会を読む | Shintoku Atlas",
  description: "新得町議会のライブ配信を要約・構造化し、意思決定の記録としてアーカイブしています。",
}

// ── 型定義 ─────────────────────────────────────────────────────────────────
interface Part {
  label:     string
  youtube?:  string
  pdf?:      string
  slidesDir: string
}

interface Summary {
  issues:      string
  conflicts:   string
  nextActions: string
}

interface GikaiSession {
  id:              string
  officialTitle:   string
  narrativeTitle?: string
  date:            string
  summary?:        Summary
  parts:           Part[]
}

// ── データ読み込み ──────────────────────────────────────────────────────────
function getSessions(): GikaiSession[] {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as GikaiSession[]
  } catch {
    return []
  }
}

// ── 日付フォーマット ────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  })
}

// ──────────────────────────────────────────────────────────────────────────────

export default function GikaiSessionsPage() {
  const sessions = getSessions()

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="mb-10">
        <Link
          href="/"
          className="text-textSub text-sm hover:text-textMain transition-colors mb-4 inline-block"
        >
          ← トップ
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          町議会を読む
        </h1>
        <p className="text-textMain/70 text-lg">
          新得町議会のライブ配信を要約・構造化し、<br className="hidden sm:inline" />
          意思決定の記録としてアーカイブ
        </p>
      </div>

      {/* ── セッション一覧 ─────────────────────────────────────────────── */}
      {sessions.length === 0 ? (
        <p className="text-textSub text-center py-20">会議データがありません</p>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/gikai/sessions/${session.id}`}
              className="block bg-ink border border-line rounded-xl p-5 hover:border-accent transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* 日付 */}
                  <p className="text-xs text-accent font-semibold tracking-wide mb-1.5">
                    {formatDate(session.date)}
                  </p>
                  {/* タイトル：narrativeTitle 優先、なければ officialTitle */}
                  <h2 className="text-base md:text-lg font-semibold text-textMain
                                  group-hover:text-accent/90 transition-colors leading-snug mb-1">
                    {session.narrativeTitle ?? session.officialTitle}
                  </h2>
                  {/* narrativeTitle がある場合のみ正式名称を補助表示 */}
                  {session.narrativeTitle && (
                    <p className="text-xs text-textSub/60 mb-3 leading-snug">
                      {session.officialTitle}
                    </p>
                  )}
                  {/* サマリー */}
                  {session.summary && (
                    <dl className="mb-3 space-y-0.5">
                      {([
                        { dt: "論点",       dd: session.summary.issues },
                        { dt: "争点",       dd: session.summary.conflicts },
                        { dt: "次アクション", dd: session.summary.nextActions },
                      ] as const).map(({ dt, dd }) => dd && (
                        <div key={dt} className="flex gap-1.5 items-baseline">
                          <dt className="text-[11px] text-textSub/50 whitespace-nowrap shrink-0">{dt}：</dt>
                          <dd className="text-sm leading-relaxed text-textMain/70 break-words line-clamp-1">{dd}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {/* パートバッジ */}
                  <div className="flex flex-wrap gap-2">
                    {session.parts.map(part => (
                      <span key={part.slidesDir}
                        className="inline-flex items-center gap-1.5 text-xs
                                   bg-line text-textSub rounded-full px-2.5 py-0.5">
                        {part.youtube && (
                          <svg className="w-3 h-3 text-red-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10
                                     10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41
                                     0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                          </svg>
                        )}
                        {part.pdf && (
                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0
                                     2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
                          </svg>
                        )}
                        {part.label}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-textSub/40 text-xl shrink-0 mt-1
                                  group-hover:text-accent/60 transition-colors">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
