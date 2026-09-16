import fs from "fs"
import path from "path"
import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { LABELS } from "@/lib/labels"
import GiketsuBrowser from "./GiketsuBrowser"
import GiketsuStatic from "./GiketsuStatic"
import type { GikaiLinks, GiketsuSession } from "./types"

export const metadata: Metadata = {
  title: `${LABELS.giketsu.text} | Shintoku Atlas`,
  description: "何が決まり、何が見送られたか。令和6年からの議案を、会期をまたいで一覧にしています。",
}

// ── データ読み込み ──────────────────────────────────────────────────────────
// どちらもビルド時に読める静的JSON。以前はクライアントから fetch していたが、
// そのせいで一覧がハイドレーション＋2往復のあとにしか出なかった。

function loadJSON<T>(...segments: string[]): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), ...segments), "utf-8")) as T
  } catch {
    return null
  }
}

export default function GikaiPage() {
  const sessions = loadJSON<GiketsuSession[]>("public", "data", "giketsu_index.json") ?? []
  const links    = loadJSON<GikaiLinks>("public", "data", "gikai_links.json") ?? {}

  return (
    <div className="max-w-[1040px] mx-auto px-6">
      {/* ── ヘッダー ─────────────────────────────────────── */}
      <div className="pt-12 pb-2 mb-8">
        <p className="text-[12px] font-bold tracking-[0.14em] text-accent mb-3">
          {LABELS.giketsu.formal}の索引
        </p>
        <h1
          className="font-mincho font-bold leading-[1.4] text-textMain"
          style={{ fontSize: "clamp(26px, 4vw, 38px)" }}
        >
          {LABELS.giketsu.text}
        </h1>
        <p className="text-[13.5px] text-textMuted mt-2.5 max-w-[560px]">
          何が決まり、何が見送られたか。令和6年からの議案を、会期をまたいで一覧にしています。
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
          <Link
            href="/gikai/sessions"
            className="group inline-block text-[13px] font-bold border-b-2 border-textMain pb-[2px]
                       transition-colors hover:text-accent hover:border-accent"
          >
            {LABELS.sessions.formal}の記録を読む →
          </Link>
          {/* 主要導線ではないので、ヘッダーではなくここと フッターから辿らせる */}
          <Link
            href="/insights"
            className="group inline-block text-[13px] font-bold border-b-2 border-textMain pb-[2px]
                       transition-colors hover:text-accent hover:border-accent"
          >
            {LABELS.insights.text} →
          </Link>
        </div>
      </div>

      {/* ── 一覧と絞り込み ─────────────────────────────────
          GiketsuBrowser は useSearchParams() を使うので Suspense 境界が要る。
          そのフォールバックに「読み込み中」ではなく GiketsuStatic（本物の先頭100件）を
          置いてあるので、**一覧そのものが静的HTMLに入る。**
          ハイドレーション後に GiketsuBrowser が同じ markup で置き換わる。 */}
      {sessions.length === 0 ? (
        <p className="text-textMuted text-center py-20">議決データがありません</p>
      ) : (
        <Suspense fallback={<GiketsuStatic sessions={sessions} links={links} />}>
          <GiketsuBrowser sessions={sessions} links={links} />
        </Suspense>
      )}

      <div className="h-16" />
    </div>
  )
}
