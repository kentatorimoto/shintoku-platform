import fs from "fs"
import path from "path"
import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { LABELS } from "@/lib/labels"
import SessionsList, { type GikaiSession } from "./SessionsList"

export const metadata: Metadata = {
  title: `${LABELS.sessions.text} | Shintoku Atlas`,
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
  const sessions   = getSessions()
  const giketsuMap = getGiketsuMap()

  return (
    <div className="max-w-[1040px] mx-auto px-6">

      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="pt-12 pb-2 mb-8">
        <p className="text-[12px] font-bold tracking-[0.14em] text-accent mb-3">
          {LABELS.sessions.formal}の索引
        </p>
        <h1
          className="font-mincho font-bold leading-[1.4] text-textMain"
          style={{ fontSize: "clamp(26px, 4vw, 38px)" }}
        >
          {LABELS.sessions.text}
        </h1>
        <p className="text-[13.5px] text-textMuted mt-2.5 max-w-[560px]">
          新得町議会のライブ配信を要約・構造化し、意思決定の記録としてアーカイブしています。
          AIによる要約を含むため、内容に誤りがある場合があります。
        </p>
        <Link
          href="/gikai"
          className="group inline-block text-[13px] font-bold border-b-2 border-textMain pb-[2px] mt-4
                     transition-colors hover:text-accent hover:border-accent"
        >
          {LABELS.giketsu.text}を読む →
        </Link>
      </div>

      {/* ── 一覧＆絞り込み（Client Component） ──────────────────────────── */}
      {sessions.length === 0 ? (
        <p className="text-textMuted text-center py-20">会議データがありません</p>
      ) : (
        <Suspense fallback={<p className="text-textMuted text-center py-20">読み込み中…</p>}>
          <SessionsList sessions={sessions} giketsuMap={giketsuMap} />
        </Suspense>
      )}

      <div className="h-16" />
    </div>
  )
}
