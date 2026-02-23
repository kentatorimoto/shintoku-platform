import Link from "next/link"

type SourceItem = {
  title: string
  url: string
  note?: string
}

const PRIMARY_SOURCES: SourceItem[] = [
  {
    title: "新得町 公式サイト",
    url: "https://www.shintoku-town.jp/",
    note: "新得町が公開する行政情報の一次情報源",
  },
  {
    title: "北海道十勝新得町議会 YouTube チャンネル",
    url: "https://www.youtube.com/@%E5%8C%97%E6%B5%B7%E9%81%93%E5%8D%81%E5%8B%9D%E6%96%B0%E5%BE%97%E7%94%BA%E8%AD%B0%E4%BC%9A",
    note: "新得町議会が公開する会議の録画アーカイブ（一次情報）",
  },
]

const DERIVED_MATERIALS: SourceItem[] = []

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
        {/* Title */}
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Sources
          </h1>
        </header>

        {/* Primary */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="text-xs font-semibold text-textSub tracking-widest">
              一次情報
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {PRIMARY_SOURCES.map((item) => (
              <SourceCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        {/* Derived */}
        {DERIVED_MATERIALS.length > 0 && (
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
        )}
      </div>
    </main>
  )
}