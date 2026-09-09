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
    <div className="max-w-[1040px] mx-auto px-6">
      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="pt-12 pb-2 mb-8">
        <Link
          href="/process"
          className="text-textSub text-sm hover:text-textMain transition-colors mb-4 inline-block"
        >
          ← 意思決定の流れを読む
        </Link>
        <p className="text-[12px] font-bold tracking-[0.14em] text-accent mb-3">意思決定タイムライン</p>
        <h1
          className="font-mincho font-bold leading-[1.4] text-textMain"
          style={{ fontSize: "clamp(26px, 4vw, 38px)" }}
        >
          議論のたどりかた
        </h1>
        <p className="text-[13.5px] text-textSub mt-2.5 max-w-[560px]">
          テーマを選ぶと、その話題がどの会期をどう渡っていったかが並びます。
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
