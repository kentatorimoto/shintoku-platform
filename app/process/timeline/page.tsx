import fs from "fs"
import path from "path"
import type { Metadata } from "next"
import Link from "next/link"
import Timeline, { type GikaiSession } from "./Timeline"

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

/**
 * `?tag=` はサーバーで解決する。/process・/process/issues・/process/priorities から
 * タグ付きで入ってくるので、URLが状態を持つ形の方がもともと素直だった。
 *
 * このページは searchParams を読むので静的プリレンダではなくリクエストごとの描画になる。
 * データはビルド時に読んだJSONなので描画自体は一瞬で、以前のように
 * Suspense のフォールバック（「読み込み中…」）がHTMLに出ることはなくなる。
 */
export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const { tag } = await searchParams
  const sessions = getSessions()

  return (
    <div className="max-w-[1040px] mx-auto px-6">
      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="pt-12 pb-2 mb-8">
        <Link
          href="/process"
          className="text-textMuted text-sm hover:text-textMain transition-colors mb-4 inline-block"
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
        <p className="text-[13.5px] text-textMuted mt-2.5 max-w-[560px]">
          テーマを選ぶと、その話題がどの会期をどう渡っていったかが並びます。
        </p>
      </div>

      {/* ── テーマ選択・タイムライン ─────────────────────────────────
          Suspense で包まない。包むとフォールバックが静的HTMLに出てしまう。 */}
      {sessions.length === 0 ? (
        <p className="text-textMuted text-center py-20">会議データがありません</p>
      ) : (
        <Timeline sessions={sessions} tag={tag} />
      )}
    </div>
  )
}
