import Link from "next/link"

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
    meta: "3件",
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
        <Link href="/" className="backLink">
          ← トップに戻る
        </Link>
        <h1 className="pageTitle">意思決定プロセス</h1>
        <p className="pageDesc">町の課題・議論・計画策定の流れを可視化</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
        <Link href="/insights" className="card cardHover">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-textMain">分析データ</h2>
            <p className="mt-2 text-textSub">議決データの集計・タグ分布・可視化</p>
            <p className="mt-4 text-sm text-accent">→ 分析を見る</p>
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