import Link from "next/link"

const cards = [
  {
    href: "/process/priorities",
    title: "政策の優先度",
    desc: "町の政策議論の焦点・優先度を整理",
    meta: "カテゴリ一覧",
  },
  {
    href: "/process/issues",
    title: "論点カード",
    desc: "議論・判断・次の一手を、公開情報から要点抽出",
    meta: "テーマ別に閲覧",
  },
  {
    href: "/process/timeline",
    title: "意思決定タイムライン",
    desc: "計画策定・議論・判断の節目を時系列で整理",
    meta: "マイルストーン",
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
        <p className="pageDesc">
          町の課題・議論・計画策定の流れを可視化（非公式）
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card cardHover block">
            <div className="text-textMain font-semibold text-lg">
              {c.title}
            </div>
            <div className="mt-2 text-textSub text-sm leading-relaxed">
              {c.desc}
            </div>
            <div className="mt-4 text-accent text-sm">
              → 開く <span className="text-textSub">（{c.meta}）</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 card">
        <div className="text-textMain font-semibold">補足</div>
        <ul className="mt-2 space-y-1 text-sm text-textSub leading-relaxed">
          <li>・内容は公開情報／資料をベースに、読みやすく編集したものです。</li>
          <li>・一次情報は各カード内の「出典」から辿れます。</li>
        </ul>
      </div>
    </div>
  )
}