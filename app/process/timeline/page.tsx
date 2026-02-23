import fs from "fs"
import path from "path"
import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import TimelineClient, { type GikaiSession } from "./TimelineClient"

export const metadata: Metadata = {
  title: "意思決定タイムライン | Shintoku Atlas",
  description: "テーマを選んで、町の議論の流れを読む",
}

function getSessions(): GikaiSession[] {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as GikaiSession[]
  } catch {
    return []
  }
}

export default function TimelinePage({
  searchParams,
}: {
  searchParams?: { tag?: string }
}) {
  const sessions  = getSessions()
  const initialTag = searchParams?.tag ?? "エネルギー"

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="mb-10">
        <Link
          href="/process"
          className="text-textSub text-sm hover:text-textMain transition-colors mb-4 inline-block"
        >
          ← 意思決定の流れを読む
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          意思決定タイムライン
        </h1>
        <p className="text-textMain/70 text-lg">
          テーマを選んで、町の議論の流れを読む
        </p>
      </div>

      {/* ── タグ選択・タイムライン（Client Component） ───────────────── */}
      {sessions.length === 0 ? (
        <p className="text-textSub text-center py-20">会議データがありません</p>
      ) : (
        <Suspense fallback={<p className="text-textSub text-center py-20">読み込み中…</p>}>
          <TimelineClient sessions={sessions} initialTag={initialTag} />
        </Suspense>
      )}
    </div>
  )
}
