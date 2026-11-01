import type { Metadata } from "next"
import Link from "next/link"
import detail from "@/content/traces/ekimae.json"
import view from "@/content/traces/ekimae.view.json"
import DesktopTimeline, { MobileTimeline, PlanChanges } from "./Timeline"

export const metadata: Metadata = {
  title: "駅前の15年（試作） | Shintoku Atlas",
  description: "町の公式会議録から、2010年の一般質問から2026年までの駅前の再整備の流れを並べた試作ページ。",
  robots: { index: false },
}

interface DetailCitation {
  meeting: string
  date: string
  speaker: string
  role: string
  page: number
  url: string
  quote: string
}
interface LinkCitation { meeting: string; page: number; url: string; date: string; speaker: string; role: string }

const toDot = (iso: string) => iso.replace(/-/g, ".")

function PdfLink({ c, className = "" }: { c: LinkCitation; className?: string }) {
  return (
    <a href={c.url} target="_blank" rel="noopener noreferrer"
       className={`underline underline-offset-2 hover:text-accent transition-colors ${className}`}>
      {c.meeting} p.{c.page}
    </a>
  )
}

function DetailCitations({ items }: { items: DetailCitation[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((c, i) => (
        <li key={i} className="text-[12px] leading-relaxed text-textMuted">
          <PdfLink c={c} /> ／ {toDot(c.date)} ／ {c.speaker} {c.role}
          <span className="block text-textSub">「{c.quote}」</span>
        </li>
      ))}
    </ul>
  )
}

function DetailEntry({ date, text, citations }: { date: string; text: string; citations: DetailCitation[] }) {
  return (
    <div className="border-l-2 border-line pl-4">
      <p className="mono text-[12px] text-textMuted mb-1">{toDot(date)}</p>
      <p className="text-sm leading-relaxed text-textMain">{text}</p>
      <DetailCitations items={citations} />
    </div>
  )
}

export default function EkimaeTracePage() {
  const [before, after] = view.contrast
  const { years, total, increase } = view.stats
  const costMax = 40

  return (
    <div className="max-w-[1040px] mx-auto px-4 md:px-6 pb-24">
      {/* ── 題名 ─────────────────────────── */}
      <header className="pt-10 md:pt-14 pb-8">
        <Link href="/process" className="text-textMuted text-sm hover:text-textMain transition-colors inline-block mb-6">
          ← 流れを読む
        </Link>
        <p className="text-[12px] font-bold tracking-[0.14em] text-accent mb-2">試作・未レビュー</p>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-textMain">{view.title}</h1>
        <p className="text-textSub text-base md:text-lg mt-3">{view.subtitle}</p>
      </header>

      {/* ── 2011 と 2026 ─────────────────── */}
      <section className="grid md:grid-cols-2 gap-px bg-lineStrong border border-lineStrong rounded-[3px] overflow-hidden mb-12">
        {[before, after].map((item, i) => (
          <figure key={item.year} className={`${i === 0 ? "bg-paper" : "bg-ink"} p-6 md:p-9`}>
            <p className={`mono text-4xl md:text-5xl mb-4 ${i === 1 ? "text-accent" : "text-textMuted"}`}>{item.year}</p>
            <blockquote className="text-2xl md:text-3xl font-bold leading-snug text-textMain">
              「{item.citation.quote}」
            </blockquote>
            <figcaption className="mt-4 text-[13px] leading-relaxed text-textMuted">
              {item.citation.speaker} {item.citation.role} ／ {toDot(item.citation.date)}
              <br />
              <PdfLink c={item.citation} />
            </figcaption>
          </figure>
        ))}
      </section>

      {/* ── 大きな数字 ─────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mb-14" aria-label="数字で見る">
        <div>
          <p className="mono text-5xl md:text-6xl text-textMain">{years.value}</p>
          <p className="text-[13px] leading-relaxed text-textMuted mt-2">{years.note}</p>
        </div>
        {[total, increase].map((s, i) => (
          <div key={s.value}>
            <p className={`mono text-5xl md:text-6xl ${i === 1 ? "text-accent" : "text-textMain"}`}>{s.value}</p>
            <p className="text-[13px] leading-relaxed text-textMuted mt-2">
              {s.note}<br /><PdfLink c={s.citation} />
            </p>
          </div>
        ))}
      </section>

      {/* ── 年表 ────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-textMain mb-1">6つの帯で見る</h2>
        <p className="text-[13px] leading-relaxed text-textMuted mb-5">点を押すと町の会議録PDFの該当ページが開きます。</p>
        <div className="hidden md:block"><DesktopTimeline /></div>
        <div className="md:hidden"><MobileTimeline /></div>
        <PlanChanges />
      </section>

      {/* ── 延期の理由 ──────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-textMain mb-5">温浴宿泊施設の開業延期の理由</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {view.delayReasons.map(r => (
            <figure key={r.subject} className="bg-ink border border-line rounded-[3px] p-5">
              <figcaption className="text-[13px] font-bold text-textMuted mb-2">{r.subject}</figcaption>
              <blockquote className="text-[15px] font-bold leading-snug text-textMain">「{r.citation.quote}」</blockquote>
              <p className="text-[12px] text-textMuted mt-2">
                {r.citation.speaker} {r.citation.role} ／ {toDot(r.citation.date)} ／ <PdfLink c={r.citation} />
              </p>
            </figure>
          ))}
        </div>
      </section>

      {/* ── 事業費 ──────────────────────── */}
      <section className="mb-14 max-w-[720px]">
        <h2 className="text-2xl font-bold text-textMain mb-1">事業費の増え方</h2>
        <p className="text-[13px] leading-relaxed text-textMuted mb-5">
          茜が増額分。足した合計額は会議録で述べられていません。
        </p>
        <div className="space-y-6">
          {view.cost.map(row => (
            <figure key={row.label}>
              <figcaption className="text-sm font-bold text-textMain mb-2">{row.label}</figcaption>
              <div className="flex h-5 gap-[2px]" role="img" aria-label={`${row.baseLabel}、${row.plusLabel}`}>
                <div className="bg-textMain rounded-l-[4px]" style={{ width: `${(row.base / costMax) * 100}%` }} title={row.baseLabel} />
                <div className="bg-accent text-onAccent rounded-r-[4px]" style={{ width: `${(row.plus / costMax) * 100}%` }} title={row.plusLabel} />
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-textSub">
                <span className="mono">{row.baseLabel}</span>
                <span className="text-accent font-bold mono"> ＋{row.plusLabel}</span>
              </p>
              <p className="text-[12px] text-textMuted">
                {row.citations.map((c, i) => (
                  <span key={c.url}>{i > 0 && "／"}<PdfLink c={c} /></span>
                ))}
              </p>
            </figure>
          ))}
        </div>
      </section>

      {/* ── 発言カード ──────────────────── */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-textMain mb-5">意見が分かれたところ</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {view.cards.map(card => (
            <article key={card.topic} className="bg-ink border border-line rounded-[3px] p-5">
              <h3 className="text-[13px] font-bold text-textMuted mb-3">
                {card.topic} <span className="mono font-normal">{toDot(card.question.date)}</span>
              </h3>
              {[{ tag: "問", c: card.question }, { tag: "答", c: card.answer }].map(({ tag, c }) => (
                <div key={tag} className="flex gap-3 mb-3 last:mb-0">
                  <span aria-hidden className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${
                    tag === "問" ? "border border-textMain text-textMain" : "bg-textMain text-paper"}`}>{tag}</span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-snug text-textMain">「{c.quote}」</p>
                    <p className="text-[12px] text-textMuted mt-1">
                      {c.speaker} {c.role} ／ <PdfLink c={c} />
                    </p>
                  </div>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>

      {/* ── 詳しく見る ──────────────────── */}
      <details className="border-t border-lineStrong pt-5 group">
        <summary className="cursor-pointer list-none flex items-center justify-between text-lg font-bold text-textMain">
          詳しく見る
          <span className="mono text-[12px] font-normal text-textMuted group-open:hidden">節目{detail.milestones.length}個を開く ↓</span>
        </summary>
        <div className="max-w-[760px] mt-6 space-y-10">
          <p className="text-sm leading-relaxed text-textSub">
            以下はAIが組み立てた未レビューの下書きで、誤りを含む可能性があります。各項目の出典で確かめられます。
          </p>
          <section>
            <h3 className="font-bold text-textMain mb-3">最初に議会で出た発言</h3>
            <DetailEntry {...detail.firstMention} />
          </section>
          <section>
            <h3 className="font-bold text-textMain mb-3">論点の枝分かれ</h3>
            <div className="space-y-4">
              {detail.branches.map(b => (
                <div key={b.id}>
                  <h4 className="text-sm font-bold text-textMain">{b.name}</h4>
                  <p className="text-sm leading-relaxed text-textSub">{b.text}</p>
                  <DetailCitations items={b.citations} />
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="font-bold text-textMain mb-3">節目</h3>
            <div className="space-y-5">
              {detail.milestones.map((m, i) => (
                <div key={i} className="border-l-2 border-line pl-4">
                  <p className="mono text-[12px] text-textMuted">{toDot(m.date)} ／ {m.kind}</p>
                  <h4 className="text-sm font-bold text-textMain">{m.title}</h4>
                  <p className="text-sm leading-relaxed text-textSub">{m.text}</p>
                  <DetailCitations items={m.citations} />
                </div>
              ))}
            </div>
          </section>
          {[{ h: "繰り返し出てくる問い", rows: detail.recurringQuestions.map(q => ({ t: q.question, o: q.occurrences })) },
            { h: "時期ごとの答弁", rows: detail.answerChanges.map(q => ({ t: q.topic, o: q.occurrences })) }].map(block => (
            <section key={block.h}>
              <h3 className="font-bold text-textMain mb-3">{block.h}</h3>
              <div className="space-y-6">
                {block.rows.map(r => (
                  <div key={r.t}>
                    <h4 className="text-sm font-bold text-textMain mb-2">{r.t}</h4>
                    <div className="space-y-4">{r.o.map((o, i) => <DetailEntry key={i} {...o} />)}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <section>
            <h3 className="font-bold text-textMain mb-3">抜粋からは読み取れなかったこと</h3>
            <ul className="space-y-1.5">
              {detail.unknowns.map(u => <li key={u} className="text-sm leading-relaxed text-textSub">・{u}</li>)}
            </ul>
          </section>
        </div>
      </details>
    </div>
  )
}
