import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "意思決定の流れを読む | Shintoku Atlas",
  description: "何がどう積み上がり、決まっていくのか。",
}

const CARDS = [
  {
    href: "/process/priorities",
    title: "重点テーマ",
    desc: "町の政策議論の焦点・優先度を整理",
    meta: "5カテゴリ",
  },
  {
    href: "/process/issues",
    title: "論点カード",
    desc: "複数会議をまたいで繰り返される争点を読む",
    meta: "6件",
  },
  {
    href: "/process/timeline",
    title: "意思決定タイムライン",
    desc: "計画策定の節目と意思決定の流れ",
    meta: "4マイルストーン",
  },
] as const

export default function ProcessPage() {
  return (
    <div className="pageWrap">
      <header className="pageHeader">
        <h1 className="pageTitle">意思決定の流れを読む</h1>
        <p className="pageDesc">何がどう積み上がり、決まっていくのか。</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
        <Link href="/insights" className="card cardHover">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-textMain">データで見る</h2>
            <p className="mt-2 text-textSub">議決の分布・タグ・年別推移を読む。</p>
            <p className="mt-4 text-sm text-accent">→ 見る</p>
          </div>
        </Link>
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="card cardHover">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-textMain">{c.title}</h2>
                <p className="mt-2 text-textSub">{c.desc}</p>
                <p className="mt-4 text-sm text-accent">→ 開く <span className="text-textSub">（{c.meta}）</span></p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}