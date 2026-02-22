import Link from "next/link"

export default function Home() {

  return (
    <main className="min-h-screen bg-base text-textMain font-sans p-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
<section className="max-w-3xl py-20 md:py-36 mb-16">
  <h2 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight break-keep">
  町を、読む。
</h2>

  <p className="text-textMain/70 text-lg md:text-xl mt-6 leading-relaxed">
    ニュースではなく、流れを見る。<br />
    断片ではなく、構造を見る。
  </p>

  <div className="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
    <Link
      href="/process"
      className="inline-flex items-center justify-center w-full md:w-auto bg-accent text-base font-semibold px-7 py-4 md:py-3 rounded-xl hover:bg-accentSoft transition-colors"
    >
      意思決定の流れを見る →
    </Link>

    <Link
      href="/gikai/sessions"
      className="inline-flex items-center justify-center w-full md:w-auto border border-line text-textMain font-semibold px-7 py-4 md:py-3 rounded-xl hover:border-accent bg-transparent transition-colors"
    >
      町議会を読む →
    </Link>
  </div>
</section>

       {/* Modules */}
<section>
  <h2 className="text-2xl font-bold mb-6">ACTIVE MODULES</h2>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    
    {/* 1. 意思決定プロセス */}
    <Link
      href="/process"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">意思決定プロセス</h3>
      <p className="text-textSub mb-4">
        町の動きが、一本の線でわかる
      </p>
      <div className="text-sm text-accent font-medium">
        → 流れを見る
      </div>
    </Link>

    {/* 2. 町議会を読む */}
    <Link
      href="/gikai/sessions"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">町議会を読む</h3>
      <p className="text-textSub mb-4">
        町議会のライブ映像を構造化し、<br />
        論点・争点・動きを読める形で蓄積
      </p>
      <div className="text-sm text-accent font-medium">
        → 議会を読む
      </div>
    </Link>

    {/* 3. 分析（インサイト） */}
    <Link
      href="/insights"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">分析（インサイト）</h3>
      <p className="text-textSub mb-4">
        議決 × テーマ・論点のクロス集計と可視化
      </p>
      <div className="text-sm text-accent font-medium">
        → データを読む
      </div>
    </Link>

    {/* 5. 町政ニュース */}
    <Link
      href="/announcements"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">町政ニュース</h3>
      <p className="text-textSub mb-4">
        新得町の最新お知らせを自動収集・検索
      </p>
      <div className="text-sm text-accent font-medium">
        → 最新を見る
      </div>
    </Link>

    {/* 5. 広報しんとくアーカイブ */}
    <Link
      href="/newsletters"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">
        広報しんとくアーカイブ
      </h3>
      <p className="text-textSub mb-4">
        広報誌PDF検索・全文検索
      </p>
      <div className="text-sm text-accent font-medium">
        → 記事を探す
      </div>
    </Link>

    {/* 6. 議会（議決結果） */}
    <Link
      href="/gikai"
      className="bg-ink border border-line rounded-xl p-6 hover:border-accent transition-all"
    >
      <h3 className="text-xl font-semibold mb-2">議会（議決結果）</h3>
      <p className="text-textSub mb-4">
        議案・意見案の可決・否決結果を検索する
      </p>
      <div className="text-sm text-accent font-medium">
        → 議決を調べる
      </div>
    </Link>

  </div>
</section>
      </div>
    </main>
  )
}