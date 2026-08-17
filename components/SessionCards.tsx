"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import PlateFrame from "@/components/PlateFrame"
import { CARD_KIND_LABELS, LABELS } from "@/lib/labels"
import type { CardItem } from "@/scripts/lib/schema"

interface Props {
  cards: CardItem[]
}

/**
 * 要点カード。旧NotebookLMスライドの後継で、レビュー済みMDの派生物（スキーマ §11）。
 * summary の直下に置き、横スワイプで会期の要点を数十秒で通読できるようにする。
 */
export default function SessionCards({ cards }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  if (cards.length === 0) return null

  /** スクロール位置から現在のカードを割り出す（カード幅は等幅なので割り算で足りる）。 */
  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    if (!card) return
    const step = card.offsetWidth + 16 // gap-4
    setIndex(Math.min(cards.length - 1, Math.round(el.scrollLeft / step)))
  }

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[15px] font-bold text-textMain leading-snug">{LABELS.cards.text}</h2>
        <span className="mono text-[11px] tracking-[0.1em] text-textSub tabular-nums">
          {index + 1} / {cards.length}
        </span>
      </div>

      {/* 図郭ティックが枠の外へ 8px はみ出すので、コンテナ側で余白を確保する */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbarNone
                   -mx-4 px-4 sm:-mx-3 sm:px-3 py-3"
      >
        {cards.map((card, i) => (
          <div key={i} className="snap-start shrink-0 w-[85%] sm:w-[340px]">
            <PlateFrame className="h-full px-5 py-6 flex flex-col bg-ink">
              <p className="text-[11px] font-bold tracking-[0.14em] text-accent mb-3">
                {CARD_KIND_LABELS[card.kind] ?? card.kind}
              </p>

              {card.value && (
                <p className="mono text-[26px] leading-none font-bold text-textMain mb-3 tabular-nums">
                  {card.value}
                </p>
              )}

              <h3 className="font-mincho text-[19px] font-bold leading-[1.4] text-textMain mb-2.5">
                {card.title}
              </h3>

              <p className="text-[13px] text-textSub leading-relaxed flex-1">{card.detail}</p>

              {card.link && (
                <Link
                  href={card.link}
                  className="mt-4 inline-block text-[12.5px] font-bold border-b-2 border-textMain pb-[2px]
                             self-start transition-colors hover:text-accent hover:border-accent"
                >
                  くわしく読む →
                </Link>
              )}
            </PlateFrame>
          </div>
        ))}
      </div>
    </section>
  )
}
