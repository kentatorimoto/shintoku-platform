import Link from "next/link"

type SourceItem = {
  title: string
  url: string
  note?: string
}

const PRIMARY_SOURCES: SourceItem[] = [
  {
    title: "新得町 議会中継（公式）",
    url: "https://www.shintoku-town.jp/gyousei/gikai/gikailive/",
    note: "議会中継・関連ページ（一次情報）",
  },
  {
    title: "YouTube（議会関連動画）",
    url: "https://www.youtube.com/watch?v=14_23_jU3pc",
    note: "議会関連の公開動画（一次情報）",
  },
]

const DERIVED_MATERIALS: SourceItem[] = [
  {
    title: "Shintoku 10-Year Plan Reality Check",
    url: "#",
    note: "上記YouTube動画を NotebookLM で要約・スライド化した二次資料（内部生成）。",
  },
]

function SourceCard({ item }: { item: SourceItem }) {
  const isExternal = item.url.startsWith("http")
  const isPlaceholder = item.url === "#"

  const CardInner = (
    <div
      className={`bg-ink border border-line rounded-xl p-6 transition-all ${
        isPlaceholder ? "opacity-60" : "hover:border-accent"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-textMain">
            {item.title}
          </h3>

          {item.note && (
            <p className="text-textMain/70 text-sm mt-2 leading-relaxed">
              {item.note}
            </p>
          )}

          <div className="mt-4 text-sm text-accent font-semibold">
            {isPlaceholder ? "準備中" : isExternal ? "出典を見る ↗" : "開く →"}
          </div>
        </div>

        <div className="shrink-0 text-accent text-sm font-semibold">
          {isPlaceholder ? "" : isExternal ? "↗" : "→"}
        </div>
      </div>
    </div>
  )

  // まだリンクを踏ませない（# の場合）
  if (isPlaceholder) return <div>{CardInner}</div>

  // 外部URLは a、内部は Link
  if (isExternal) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer">
        {CardInner}
      </a>
    )
  }
  return <Link href={item.url}>{CardInner}</Link>
}

export default function SourcesPage() {
  return (
    <main className="min-h-screen bg-base text-textMain font-sans px-8 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        {/* Back */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-textSub text-sm hover:text-textMain transition-colors inline-block"
          >
            ← トップに戻る
          </Link>
        </div>

        {/* Title */}
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            出典一覧
          </h1>
          <p className="text-textMain/70 text-lg mt-3 leading-relaxed">
            このサイトで使用している公開情報の出典（一次情報）と、そこから作成した二次資料の一覧です。
          </p>
        </header>

        {/* Primary */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="text-xs font-semibold text-textSub uppercase tracking-widest">
              Primary Sources
            </h2>
            <span className="text-textSub text-xs">公開情報（一次情報）</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {PRIMARY_SOURCES.map((item) => (
              <SourceCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        {/* Derived */}
        <section>
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="text-xs font-semibold text-textSub uppercase tracking-widest">
              Derived Materials
            </h2>
            <span className="text-textSub text-xs">二次資料（内部作成）</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {DERIVED_MATERIALS.map((item) => (
              <SourceCard key={item.title} item={item} />
            ))}
          </div>

          {/* Note */}
          <div className="mt-8 bg-ink border border-line rounded-xl p-6">
            <h3 className="text-lg font-semibold">注意</h3>
            <p className="text-textMain/70 text-sm mt-2 leading-relaxed">
              二次資料は、公開情報の理解を助けるための要約・整理です。正確な内容は必ず一次情報をご確認ください。
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}