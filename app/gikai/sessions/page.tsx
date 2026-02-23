import fs from "fs"
import path from "path"
import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import SessionsList, { type GikaiSession } from "./SessionsList"

export const metadata: Metadata = {
  title: "議会を読む | Shintoku Atlas",
  description: "新得町議会のライブ配信を要約・構造化し、意思決定の記録としてアーカイブしています。",
}

// ── 型定義 ─────────────────────────────────────────────────────────────────
interface GiketsuSession {
  sessionId:   string | null
  sessionName: string
  items:       unknown[]
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

function getGiketsuMap(): Record<string, { count: number; sessionName: string }> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "giketsu_index.json")
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as GiketsuSession[]
    const map: Record<string, { count: number; sessionName: string }> = {}
    for (const s of data) {
      if (s.sessionId) {
        map[s.sessionId] = { count: s.items.length, sessionName: s.sessionName }
      }
    }
    return map
  } catch {
    return {}
  }
}

// ──────────────────────────────────────────────────────────────────────────────

export default function GikaiSessionsPage() {
  const sessions    = getSessions()
  const giketsuMap  = getGiketsuMap()

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          議会を読む
        </h1>
        <p className="text-textMain/70 text-lg">
          新得町議会のライブ配信を要約・構造化し、<br className="hidden sm:inline" />
          意思決定の記録としてアーカイブ
        </p>
        <p className="text-xs text-textSub/50 mt-2">
          AIによる要約を含むため、内容に誤りがある場合があります。
        </p>
      </div>

      {/* ── フィルター＆一覧（Client Component） ────────────────────────── */}
      {sessions.length === 0 ? (
        <p className="text-textSub text-center py-20">会議データがありません</p>
      ) : (
        <Suspense fallback={<p className="text-textSub text-center py-20">読み込み中…</p>}>
          <SessionsList sessions={sessions} giketsuMap={giketsuMap} />
        </Suspense>
      )}
    </div>
  )
}
