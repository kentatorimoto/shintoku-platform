import type { Metadata } from "next"
import Link from "next/link"
import {
  PHASES,
  NAME_VARIANTS,
  FACILITY,
  UNRESOLVED,
  type TuktukEvent,
} from "@/data/topics/tuktuk"

export const metadata: Metadata = {
  title:
    "新得駅前地域交流センター「とくとく」：意思決定と制度化の流れ | Shintoku Atlas",
  description:
    "駅前周辺再整備事業の構想から制度化・運営論点化までの流れを、議会・広報の公開情報から整理する。",
}

/* ── 日付の表示 ─────────────────────────────────────────────────── */
function fmtDate(raw: string): string {
  // "2011年頃（推測）" のようなフリーテキストはそのまま返す
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/* ── 種別バッジの色 ────────────────────────────────────────────── */
const TYPE_COLORS: Record<string, string> = {
  契約: "text-accent border-accent/40",
  議案: "text-accent border-accent/40",
  運営: "text-accent border-accent/40",
  予算: "text-yellow-400 border-yellow-400/40",
  質問: "text-textSub border-line",
  報告: "text-textSub border-line",
  設計: "text-blue-400 border-blue-400/40",
  開所: "text-textMain border-textMain/40",
}

/* ── 出典リンク or テキスト ─────────────────────────────────────── */
function Source({ event }: { event: TuktukEvent }) {
  if (event.sessionId) {
    return (
      <Link
        href={`/gikai/sessions/${event.sessionId}`}
        className="text-xs text-accent hover:text-accent/70 transition-colors whitespace-nowrap"
      >
        → 会議を読む
      </Link>
    )
  }
  if (event.sourceNote) {
    return (
      <span className="text-xs text-textSub/60">{event.sourceNote}</span>
    )
  }
  return null
}

/* ── ページ ────────────────────────────────────────────────────── */
export default function TuktukPage() {
  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      {/* ── パンくず ─────────────────────────────────────────── */}
      <div className="mb-10">
        <Link
          href="/process/issues"
          className="text-textSub text-sm hover:text-textMain transition-colors mb-4 inline-block"
        >
          ← 論点カード
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-textMain">
          新得駅前地域交流センター「とくとく」
        </h1>
        <p className="text-textMain/70 text-base leading-relaxed">
          新得駅前地域交流センター「とくとく」は、駅前周辺再整備事業の一環として整備された公共複合施設である。
          <br className="hidden md:inline" />
          このページでは、議会・広報等の公開情報から、整備〜制度化〜運営論点化までの流れを整理する。
        </p>
      </div>

      {/* ── フェーズ一覧 ────────────────────────────────────── */}
      <div className="space-y-8">
        {PHASES.map((phase) => (
          <section
            key={phase.id}
            className="bg-ink border border-line rounded-xl p-6"
          >
            <h2 className="text-sm font-semibold text-textSub tracking-wide mb-5">
              {phase.label}
            </h2>

            <div className="space-y-4">
              {phase.events.map((ev, i) => (
                <div
                  key={`${phase.id}-${i}`}
                  className={`flex gap-4 items-start border-l-2 pl-4 ${
                    ev.decision
                      ? "border-accent"
                      : "border-line"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs text-accent font-semibold">
                        {fmtDate(ev.date)}
                      </span>
                      <span
                        className={`text-xs font-semibold px-1.5 py-0 rounded border ${
                          TYPE_COLORS[ev.type] ?? "text-textSub border-line"
                        }`}
                      >
                        {ev.type}
                      </span>
                    </div>
                    <p
                      className={`text-sm leading-relaxed ${
                        ev.decision
                          ? "text-textMain font-semibold"
                          : "text-textMain/70"
                      }`}
                    >
                      {ev.summary}
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <Source event={ev} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* ── 名称ゆれ ────────────────────────────────────────── */}
      <section className="mt-10 bg-ink border border-line rounded-xl p-6">
        <h2 className="text-sm font-semibold text-textSub tracking-wide mb-3">
          名称ゆれ（観測用メモ）
        </h2>
        <ul className="space-y-1">
          {NAME_VARIANTS.map((v) => (
            <li key={v} className="text-sm text-textMain/60">
              {v}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 施設概要 ────────────────────────────────────────── */}
      <section className="mt-4 bg-ink border border-line rounded-xl p-6">
        <h2 className="text-sm font-semibold text-textSub tracking-wide mb-3">
          施設概要（{FACILITY.source}より：数値のみ）
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-textSub">開所日</dt>
          <dd className="text-textMain/70">{FACILITY.openDate}</dd>
          <dt className="text-textSub">延床面積</dt>
          <dd className="text-textMain/70">{FACILITY.floorArea}</dd>
          <dt className="text-textSub">事業費</dt>
          <dd className="text-textMain/70">{FACILITY.projectCost}</dd>
        </dl>
      </section>

      {/* ── 未観測 ──────────────────────────────────────────── */}
      <section className="mt-4 bg-ink border border-line/40 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-textSub tracking-wide mb-3">
          未観測（今後の探索ポイント）
        </h2>
        <ul className="space-y-1.5">
          {UNRESOLVED.map((item) => (
            <li key={item} className="text-xs text-textSub/70 leading-relaxed">
              ・{item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
