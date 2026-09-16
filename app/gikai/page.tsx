import fs from "fs"
import path from "path"
import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { LABELS } from "@/lib/labels"
import GiketsuBrowser from "./GiketsuBrowser"
import type { GikaiLinks, GiketsuSession } from "./types"

export const metadata: Metadata = {
  title: `${LABELS.giketsu.text} | Shintoku Atlas`,
  description: "何が決まり、何が見送られたか。令和6年からの議案を、会期をまたいで一覧にしています。",
}

/**
 * リクエストに依存するものが何も無いので完全に静的化する。**外さないこと。**
 *
 * 2つの役割がある。
 *
 * 1. サーバー関数を作らせない。これが無いと next の file tracing が引き込んだものが
 *    まるごと関数に入り、727MB（上限250MB）になってデプロイが落ちた。
 * 2. GiketsuBrowser（useSearchParams を使うクライアントコンポーネント）を
 *    ビルド時に描かせる。これがあると Suspense の中身までプリレンダされるので、
 *    **一覧の先頭100件が素のHTMLに入る**（JSを切っても読める）。
 *    外すとフォールバックだけがHTMLに出て、一覧が1行も入らなくなる。
 */
export const dynamic = "force-static"

// ── データ読み込み ──────────────────────────────────────────────────────────
// どちらもビルド時に読める静的JSON。以前はクライアントから fetch していたが、
// そのせいで一覧がハイドレーション＋2往復のあとにしか出なかった。
//
// **パスは文字列リテラルで書くこと。** path.join(process.cwd(), ...segments) のように
// スプレッドで組み立てると next が参照先を静的に決められず、保険として public/ を
// まるごとトレースする（slides 553本・pdf 45本＝716MB が関数に入った）。

function read<T>(absPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf-8")) as T
  } catch {
    return null
  }
}

export default function GikaiPage() {
  // path.join の引数はすべて文字列リテラルにする。1つでも変数が混ざると
  // そのディレクトリごとトレースされる（"public/data/" + file で24本入った）。
  const sessions = read<GiketsuSession[]>(
    path.join(process.cwd(), "public", "data", "giketsu_index.json")
  ) ?? []
  const links = read<GikaiLinks>(
    path.join(process.cwd(), "public", "data", "gikai_links.json")
  ) ?? {}

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
          useSearchParams() を使うので Suspense 境界は要るが、force-static のおかげで
          中身までプリレンダされるためフォールバックは実際には出ない。
          フォールバックに一覧を置くと、同じ内容がHTMLに2回入る（644KB → 345KB）。 */}
      {sessions.length === 0 ? (
        <p className="text-textMuted text-center py-20">議決データがありません</p>
      ) : (
        <Suspense fallback={null}>
          <GiketsuBrowser sessions={sessions} links={links} />
        </Suspense>
      )}

      <div className="h-16" />
    </div>
  )
}
