import fs from "fs"
import path from "path"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import SessionDetail from "../SessionDetail"
import { ANCHORS, LABELS, qnaLabel } from "@/lib/labels"
import type { CardsData, GikaiSession, HonkaigiData, PartData, QnaData } from "@/scripts/lib/schema"

function getPartData(sessionId: string, partIndex: number): PartData | null {
  const candidates = [
    `${sessionId}_day${partIndex + 1}.json`,
    `${sessionId}_part${partIndex + 1}.json`,
    `${sessionId}.json`,
  ]

  for (const filename of candidates) {
    try {
      const filePath = path.join(process.cwd(), "public", "data", "qna", filename)
      if (!fs.existsSync(filePath)) continue
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as PartData
      if (data.part_index === partIndex) return data
    } catch {
      continue
    }
  }
  return null
}

/** 要点カード。cards.yaml があるセッションだけ生成される（スキーマ §11）。 */
function getCards(sessionId: string): CardsData | null {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "cards", `${sessionId}.json`)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as CardsData
  } catch {
    return null
  }
}

function getSessions(): GikaiSession[] {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as GikaiSession[]
  } catch {
    return []
  }
}

function getSlideImages(sessionId: string, slidesDir: string): string[] {
  const slideDir = path.join(process.cwd(), "public", "slides", sessionId, slidesDir)
  if (!fs.existsSync(slideDir)) return []
  return fs
    .readdirSync(slideDir)
    .filter(f => /^page-\d+\.jpg$/.test(f))
    .sort()
    .map(f => `/slides/${sessionId}/${slidesDir}/${f}`)
}

export async function generateStaticParams() {
  const sessions = getSessions()
  return sessions.flatMap(s =>
    s.parts.map((_, i) => ({ id: s.id, partIndex: String(i) }))
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; partIndex: string }>
}): Promise<Metadata> {
  const { id, partIndex } = await params
  const session = getSessions().find(s => s.id === id)
  if (!session) return { title: "会議アーカイブ | Shintoku Atlas" }
  const part = session.parts[Number(partIndex)]
  const partLabel = part ? ` — ${part.label}` : ""
  return {
    title: `${session.narrativeTitle ?? session.officialTitle}${partLabel} | 会議アーカイブ`,
    description: "動画と要約スライドで会議の論点を追う",
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  })
}

export default async function SessionPartPage({
  params,
}: {
  params: Promise<{ id: string; partIndex: string }>
}) {
  const { id, partIndex } = await params
  const sessions = getSessions()
  const session  = sessions.find(s => s.id === id)
  if (!session) notFound()

  const idx = Number(partIndex)
  if (isNaN(idx) || idx < 0 || idx >= session.parts.length) notFound()

  const partData = getPartData(session.id, idx)
  const qnaItems    = partData?.part_type !== "honkaigi" ? (partData as QnaData | null)?.items ?? null : null
  const honkaigiData = partData?.part_type === "honkaigi" ? partData as HonkaigiData : null

  // summary 直下に置くページ内リンク（下部の参照セクションへの導線）
  const jumpLinks = [
    honkaigiData && honkaigiData.items.length > 0
      ? { href: `#${ANCHORS.honkaigi}`, label: LABELS.honkaigi.text, count: honkaigiData.items.length }
      : null,
    qnaItems && qnaItems.length > 0
      ? { href: `#${ANCHORS.qna}`, label: qnaLabel(qnaItems[0]?.speaker_role).text, count: qnaItems.length }
      : null,
  ].filter(link => link !== null)

  const parts = session.parts.map(part => ({
    label:     part.label,
    youtube:   part.youtube ?? null,
    pdfPath:   part.pdf ? `/pdf/${part.pdf}` : null,
    images:    part.slidesDir ? getSlideImages(session.id, part.slidesDir) : [],
    slidesDir: part.slidesDir ?? "",
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
        <p className="mono text-textSub text-[13px] mb-3">
          {formatDate(session.date)}
        </p>
        <h1 className="font-mincho text-3xl md:text-4xl font-bold tracking-tight text-textMain leading-tight mb-2">
          {session.narrativeTitle ?? session.officialTitle}
        </h1>
        {session.narrativeTitle && (
          <p className="text-sm text-textSub leading-snug" style={{ fontFeatureSettings: '"palt"' }}>
            {session.officialTitle}
          </p>
        )}
        {session.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {session.tags.map(tag => (
              <span key={tag} className="text-[11.5px] font-medium border border-lineStrong text-textSub px-[11px] py-[3px] rounded-[3px]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── サマリー ＋ 参照セクションへの導線 ─────────────────────────────── */}
      {(session.summary || jumpLinks.length > 0) && (
        <div className="bg-ink border border-line rounded-[3px] p-5 sm:p-6 mb-8">
          {session.summary && (
            <dl className="space-y-2">
              {([
                { dt: "論点",        dd: session.summary.issues },
                { dt: "争点",        dd: session.summary.conflicts },
                { dt: "次アクション", dd: session.summary.nextActions },
              ] as const).map(({ dt, dd }) => dd && (
                <div key={dt} className="flex gap-2 items-baseline">
                  <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0">{dt}：</dt>
                  <dd className="text-textMain/80 text-base leading-relaxed break-words">{dd}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* 議案審議・一般質問はページ下部の参照資料。ここから1タップで届くようにする */}
          {jumpLinks.length > 0 && (
            <div className={`flex flex-wrap gap-2 ${session.summary ? "mt-5 pt-5 border-t border-line" : ""}`}>
              {jumpLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-baseline gap-2 border border-lineStrong rounded-[3px]
                             px-3 py-2 text-[13px] text-textMain
                             hover:border-accent hover:text-accent transition-colors"
                >
                  <span className="font-bold">{link.label}</span>
                  <span className="mono text-[12px] text-textSub">{link.count}件</span>
                  <span aria-hidden>↓</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── コンテンツ（Client Component: タブ切り替え）────────────────── */}
      <SessionDetail
        sessionId={session.id}
        parts={parts}
        initialPartIndex={idx}
        qnaItems={qnaItems}
        honkaigiData={honkaigiData}
        cards={getCards(session.id)?.cards ?? null}
      />
    </div>
  )
}
