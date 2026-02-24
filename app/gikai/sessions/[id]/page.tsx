import fs from "fs"
import path from "path"
import type { Metadata } from "next"
import { notFound }      from "next/navigation"
import Link              from "next/link"
import SessionDetail     from "./SessionDetail"

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

// ── スライド画像スキャン ────────────────────────────────────────────────────
function getSlideImages(sessionId: string, slidesDir: string): string[] {
  const slideDir = path.join(process.cwd(), "public", "slides", sessionId, slidesDir)
  if (!fs.existsSync(slideDir)) return []

  return fs
    .readdirSync(slideDir)
    .filter(f => /^page-\d+\.jpg$/.test(f))
    .sort()
    .map(f => `/slides/${sessionId}/${slidesDir}/${f}`)
}

// ── 静的パラメータ生成 ─────────────────────────────────────────────────────
export async function generateStaticParams() {
  const sessions = getSessions()
  return sessions.map(s => ({ id: s.id }))
}

// ── メタデータ ─────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const session = getSessions().find(s => s.id === id)
  if (!session) return { title: "会議アーカイブ | Shintoku Atlas" }
  return {
    title: `${session.narrativeTitle ?? session.officialTitle} | 会議アーカイブ`,
    description: "動画と要約スライドで会議の論点を追う",
  }
}

// ── 日付フォーマット ────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  })
}

// ──────────────────────────────────────────────────────────────────────────────

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sessions = getSessions()
  const session  = sessions.find(s => s.id === id)
  if (!session) notFound()

  // パートごとのデータを構築
  const parts = session.parts.map(part => ({
    label:     part.label,
    youtube:   part.youtube ?? null,
    pdfPath:   part.pdf ? `/pdf/${part.pdf}` : null,
    images:    getSlideImages(session.id, part.slidesDir),
    slidesDir: part.slidesDir,
  }))

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      {/* ── 戻りリンク ───────────────────────────────────────────────── */}
      <Link
        href="/gikai/sessions"
        className="text-textSub text-sm hover:text-textMain transition-colors mb-8 inline-block"
      >
        ← 議会を読む
      </Link>

      {/* ── ページヘッダー ───────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-accent text-sm font-semibold tracking-wide mb-3">
          {formatDate(session.date)}
        </p>
        {/* narrativeTitle：強く大きく */}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-textMain leading-tight mb-2">
          {session.narrativeTitle ?? session.officialTitle}
        </h1>
        {/* officialTitle：補助的に小さく */}
        {session.narrativeTitle && (
          <p className="text-sm text-textSub leading-snug" style={{ fontFeatureSettings: '"palt"' }}>
            {session.officialTitle}
          </p>
        )}
      </div>

      {/* ── サマリー ──────────────────────────────────────────────────────── */}
      {session.summary && (
        <div className="bg-ink border border-line rounded-xl p-5 sm:p-6 mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-textSub/50 mb-4">
            今回の要点
          </p>
          <dl className="space-y-2">
            {([
              { dt: "論点",       dd: session.summary.issues },
              { dt: "争点",       dd: session.summary.conflicts },
              { dt: "次アクション", dd: session.summary.nextActions },
            ] as const).map(({ dt, dd }) => dd && (
              <div key={dt} className="flex gap-2 items-baseline">
                <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0">{dt}：</dt>
                <dd className="text-textMain/80 text-base leading-relaxed break-words">{dd}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* ── コンテンツ（Client Component: タブ切り替え）────────────────── */}
      <SessionDetail
        sessionId={session.id}
        parts={parts}
      />
    </div>
  )
}
