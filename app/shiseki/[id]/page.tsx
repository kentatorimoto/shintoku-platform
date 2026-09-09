import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { LABELS } from "@/lib/labels"
import { citationFor, findShiseki, getShiseki } from "@/lib/shiseki"

export function generateStaticParams() {
  return (getShiseki()?.items ?? []).map(item => ({ id: item.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const found = findShiseki(id)
  if (!found) return { title: "土地の記憶 | Shintoku Atlas" }
  return {
    title: `${found.item.title} | 土地の記憶`,
    description: found.item.summary,
  }
}

const formatDate = (iso: string) => iso.replace(/-/g, ".")

export default async function ShisekiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const found = findShiseki(id)
  if (!found) notFound()

  const { data: { book }, item } = found

  return (
    <div className="max-w-[760px] mx-auto px-6">
      <div className="pt-12">
        <Link href="/shiseki" className="text-textSub text-sm hover:text-textMain transition-colors inline-block">
          ← {LABELS.shiseki.text}
        </Link>
      </div>

      {/* ── 見出し ───────────────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="mono font-bold text-[15px] text-textSub">
            {String(item.order).padStart(2, "0")}
          </span>
          {item.confidence === "check" && (
            <span className="text-[11px] text-accent border border-accent/50 rounded-[3px] px-2 py-[2px]">
              {LABELS.shisekiChecking.text}
            </span>
          )}
        </div>

        <h1 className="font-mincho font-bold leading-[1.35] text-textMain" style={{ fontSize: "clamp(26px, 4.4vw, 40px)" }}>
          {item.title}
        </h1>

        <dl className="flex flex-wrap gap-x-8 gap-y-2 mt-5 text-[13px]">
          {item.location && (
            <div className="flex gap-2">
              <dt className="text-textSub/70 whitespace-nowrap">ところ</dt>
              <dd className="text-textMain">{item.location}</dd>
            </div>
          )}
          {item.era && (
            <div className="flex gap-2">
              <dt className="text-textSub/70 whitespace-nowrap">年代</dt>
              <dd className="text-textMain mono">{item.era}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* ── 概要（公開するのはここまで。本文と図版は載せない）───────────── */}
      {item.summary && (
        <div className="mt-9 bg-ink border border-line rounded-[3px] p-6 sm:p-7">
          <p className="text-[15px] text-textMain leading-[1.9]">{item.summary}</p>
        </div>
      )}

      {item.confidence === "check" && (
        <p className="text-[12.5px] text-textSub mt-4 leading-relaxed">
          この史跡は、原本の記載と現地の対応を照合しているところです。
          名称や場所が変わることがあります。
        </p>
      )}

      {/* ── 議会記録との接続（Phase 4。完全一致した語だけを根拠にする）──── */}
      {item.sessions && item.sessions.length > 0 && (
        <section className="mt-12 border-t-[1.5px] border-textMain">
          <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textSub pt-4 pb-1.5">
            {LABELS.shisekiSessions.text}
          </h2>
          {item.sessions.map(s => (
            <Link
              key={s.id}
              href={`/gikai/sessions/${s.id}`}
              className="group grid grid-cols-[1fr_auto] items-baseline gap-4 py-4 px-1
                         border-b border-line rounded-[3px] transition-colors hover:bg-hover"
            >
              <span className="text-[14px] font-bold text-textMain min-w-0">
                {s.title}
                <span className="block text-[11.5px] text-textSub font-normal mt-1">
                  「{s.entity}」に触れています
                </span>
              </span>
              <span className="mono text-[11.5px] text-textSub whitespace-nowrap justify-self-end">
                {formatDate(s.date)}
                <span className="ml-2 transition-colors group-hover:text-accent">→</span>
              </span>
            </Link>
          ))}
          <p className="text-[11.5px] text-textSub/80 mt-3 leading-relaxed">
            史跡に出てくる固有名詞が、そのまま議会の記録にも出てくる会期を並べています。
            言葉が一致しただけで、同じ事柄を指しているとは限りません。
          </p>
        </section>
      )}

      {/* ── 出典（権利ガードレール3。全ページに必ず置く）────────────────── */}
      <section className="mt-12 border-t border-line pt-5">
        <p className="text-[12.5px] text-textSub leading-relaxed">
          出典 — {citationFor(book.citation, item)}
        </p>
        <p className="text-[12.5px] text-textMain mt-1.5 font-bold">{book.citation_note}</p>
        <p className="text-[11.5px] text-textSub/80 mt-3 leading-relaxed">
          このページに載せているのは、場所・年代と、原本をもとにまとめた概要だけです。
          原本の本文と図版は掲載していません。
        </p>
      </section>

      <div className="h-16" />
    </div>
  )
}
