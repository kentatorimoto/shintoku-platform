import type { Metadata } from "next"
import Link from "next/link"
import PlateFrame from "@/components/PlateFrame"
import { LABELS } from "@/lib/labels"
import { getShiseki, leadSentence } from "@/lib/shiseki"

export const metadata: Metadata = {
  title: "土地の記憶 | Shintoku Atlas",
  description: "新得町に残る史跡の記録。『しんとくの史跡』（新得町郷土研究会・1994年）をもとに、場所ごとの由来を概要で読めるようにしています。",
}

export default function ShisekiIndexPage() {
  const data = getShiseki()
  if (!data) {
    return (
      <div className="max-w-[1040px] mx-auto px-6 py-20">
        <p className="text-textSub text-center">史跡データがありません</p>
      </div>
    )
  }

  const { book, items } = data

  return (
    <div className="max-w-[1040px] mx-auto px-6">

      {/* ── 見出し ───────────────────────────────────────────────────── */}
      <div className="pt-12 pb-2">
        <p className="text-[12px] font-bold tracking-[0.14em] text-accent mb-3">町がどうしてこうなったか</p>
        <h1 className="font-mincho font-bold leading-[1.4] text-textMain" style={{ fontSize: "clamp(26px, 4vw, 38px)" }}>
          {LABELS.shiseki.text}
        </h1>
        <p className="text-[13.5px] text-textSub mt-2.5 max-w-[560px]">
          町のあちこちに、碑や標柱が立っています。そこで何があった場所なのかを、
          郷土研究会が調べた記録から{items.length}件ぶん読めるようにしました。
        </p>
      </div>

      {/* ── 出典（権利ガードレール3。一覧にも必ず置く）─────────────────── */}
      <div className="mt-9">
        <PlateFrame className="px-6 py-6 md:px-9">
          <p className="text-[12.5px] text-textSub leading-relaxed">
            出典 —『{book.title}』{book.publisher}・{book.year}年／新得町図書館蔵
          </p>
          <p className="text-[12.5px] text-textMain mt-2 font-bold">{book.citation_note}</p>
          <p className="text-[12px] text-textSub mt-3 leading-relaxed">
            ここに載せているのは、場所・年代と、原本をもとにまとめた概要だけです。
            本文と図版は掲載していません。
          </p>
        </PlateFrame>
      </div>

      {/* ── 一覧（掲載順）──────────────────────────────────────────── */}
      <section className="mt-12 border-t-[1.5px] border-textMain">
        <div className="flex items-baseline justify-between pt-4 pb-1.5">
          <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textSub">
            史跡の索引 — {items.length}件
          </h2>
          <span className="mono text-[11.5px] text-textSub">原本 p.1 — p.{book ? items[items.length - 1].page_start : ""}</span>
        </div>

        {items.map(item => (
          <Link
            key={item.id}
            href={`/shiseki/${item.id}`}
            className="group grid grid-cols-[44px_1fr] md:grid-cols-[60px_1fr_120px] items-baseline gap-3 md:gap-5
                       py-[18px] px-1 border-b border-line rounded-[3px] transition-colors hover:bg-hover"
          >
            <span className="mono font-bold text-[15px] md:text-[17px] text-textSub leading-none">
              {String(item.order).padStart(2, "0")}
            </span>

            <span className="min-w-0">
              <span className="text-[15px] font-bold text-textMain">{item.title}</span>
              {item.confidence === "check" && (
                <span className="ml-2 text-[11px] text-accent border border-accent/50 rounded-[3px] px-1.5 py-[1px] whitespace-nowrap">
                  {LABELS.shisekiChecking.text}
                </span>
              )}
              {/* 一覧では1文目だけ。全文は個別ページで読む */}
              <span className="block text-[12.5px] text-textSub font-normal mt-1 leading-relaxed">
                {leadSentence(item.summary)}
              </span>
              <span className="mono block md:hidden text-[11px] text-textSub/80 mt-1">
                p.{item.page_start}{item.era ? `　${item.era}` : ""}
              </span>
            </span>

            <span className="mono text-[11.5px] text-textSub text-right whitespace-nowrap justify-self-end hidden md:block">
              p.{item.page_start}
              {item.era && <span className="block text-[11px] mt-0.5">{item.era}</span>}
            </span>
          </Link>
        ))}
      </section>

      <p className="text-[11.5px] text-textSub/80 mt-6 leading-relaxed">
        原本の全町略図には27件の凡例がありますが、本文に独立した記事があるのは{items.length}件です。
        凡例2番「伊藤傳五郎住居跡」は独立した見出しを持たないため、原本と照合できるまで欠番にしています。
      </p>

      <div className="h-16" />
    </div>
  )
}
