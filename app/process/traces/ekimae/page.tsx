import type { Metadata } from "next"
import Link from "next/link"
import trace from "@/content/traces/ekimae.json"

export const metadata: Metadata = {
  title: "駅前の再整備の流れ（試作） | Shintoku Atlas",
  description: "町の公式会議録（平成22年〜）から、駅前の再整備をめぐる年をまたいだ流れを並べた試作ページ。",
  robots: { index: false },
}

interface Citation {
  meeting: string
  date: string
  speaker: string
  role: string
  page: number
  url: string
  quote: string
}

const toDot = (iso: string) => iso.replace(/-/g, ".")
const DECIDED = new Set(["予算", "契約", "条例", "着工", "開所", "延期", "白紙"])

function Citations({ items }: { items: Citation[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((c, i) => (
        <li key={i} className="text-[12px] leading-relaxed text-textMuted">
          <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent transition-colors">
            {c.meeting} p.{c.page}
          </a>
          <span> ／ {toDot(c.date)} ／ {c.speaker} {c.role}</span>
          <span className="block text-textSub">「{c.quote}」</span>
        </li>
      ))}
    </ul>
  )
}

function Dated({ date, text, citations }: { date: string; text: string; citations: Citation[] }) {
  return (
    <div className="border-l-2 border-line pl-4">
      <p className="mono text-[12px] text-textMuted mb-1">{toDot(date)}</p>
      <p className="text-sm leading-relaxed text-textMain">{text}</p>
      <Citations items={citations} />
    </div>
  )
}

export default function EkimaeTracePage() {
  const branchName = new Map(trace.branches.map(b => [b.id, b.name]))

  return (
    <div className="max-w-[820px] mx-auto px-6 pb-20">
      <div className="pt-12 pb-2 mb-8">
        <Link href="/process" className="text-textMuted text-sm hover:text-textMain transition-colors mb-4 inline-block">
          ← 流れを読む
        </Link>
        <p className="text-[12px] font-bold tracking-[0.14em] text-accent mb-3">試作</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-textMain">{trace.title}</h1>
        <p className="text-textSub text-base leading-relaxed">
          町の公式会議録（公開されている平成22年以降）から、キーワードで集めた発言をもとに流れを並べました。
          AIが組み立てた未レビューの下書きで、誤りを含む可能性があります。各項目の出典から、町の会議録PDFの該当ページを確かめられます。
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-lg font-bold text-textMain mb-4">最初に議会で出た発言</h2>
        <Dated {...trace.firstMention} />
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-bold text-textMain mb-4">論点の枝分かれ</h2>
        <div className="space-y-4">
          {trace.branches.map(b => (
            <div key={b.id} className="bg-ink border border-line rounded-[3px] p-5">
              <h3 className="text-sm font-bold text-textMain mb-2">{b.name}</h3>
              <p className="text-sm leading-relaxed text-textSub">{b.text}</p>
              <Citations items={b.citations} />
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-bold text-textMain mb-4">節目</h2>
        <div className="space-y-7">
          {trace.milestones.map((m, i) => (
            <article key={i} className={`border-l-2 pl-4 ${DECIDED.has(m.kind) ? "border-accent" : "border-line"}`}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="mono text-[12px] text-textMuted">{toDot(m.date)}</span>
                <span className="text-[11px] font-semibold text-textMuted border border-lineStrong rounded px-1.5">{m.kind}</span>
                {m.branches.map(b => (
                  <span key={b} className="text-[11px] text-textMuted">{branchName.get(b) ?? b}</span>
                ))}
              </div>
              <h3 className="text-[15px] font-bold text-textMain mb-1">{m.title}</h3>
              <p className="text-sm leading-relaxed text-textSub">{m.text}</p>
              <Citations items={m.citations} />
            </article>
          ))}
        </div>
      </section>

      {trace.recurringQuestions.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-bold text-textMain mb-4">繰り返し出てくる問い</h2>
          <div className="space-y-8">
            {trace.recurringQuestions.map((q, i) => (
              <div key={i}>
                <h3 className="text-[15px] font-bold text-textMain mb-3">{q.question}</h3>
                <div className="space-y-5">{q.occurrences.map((o, j) => <Dated key={j} {...o} />)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {trace.answerChanges.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-bold text-textMain mb-4">時期ごとの答弁</h2>
          <div className="space-y-8">
            {trace.answerChanges.map((q, i) => (
              <div key={i}>
                <h3 className="text-[15px] font-bold text-textMain mb-3">{q.topic}</h3>
                <div className="space-y-5">{q.occurrences.map((o, j) => <Dated key={j} {...o} />)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {trace.unknowns.length > 0 && (
        <section className="bg-ink border border-line rounded-[3px] p-5">
          <h2 className="text-sm font-bold text-textMain mb-3">抜粋からは読み取れなかったこと</h2>
          <ul className="space-y-1.5">
            {trace.unknowns.map((u, i) => <li key={i} className="text-sm leading-relaxed text-textSub">・{u}</li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
