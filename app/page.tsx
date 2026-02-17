import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <header className="mb-12 border-b border-green-400 pb-6">
          <h1 className="text-4xl mb-2">新得町オープンプラットフォーム</h1>
          <p className="text-2xl mb-2">OSPP - Open Shintoku Public Platform v0.1.0</p>
          <p className="text-green-600 mt-2">
            政党にも企業にもよらない、完全オープンな町政情報基盤
          </p>
        </header>

        {/* ステータス */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">STATUS</div>
            <div className="text-2xl">● OPERATIONAL</div>
          </div>
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">DATA POINTS</div>
            <div className="text-2xl">20+</div>
          </div>
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">LAST SYNC</div>
            <div className="text-2xl">2026.02.16</div>
          </div>
        </div>

        {/* モジュール */}
        <div>
          <h2 className="text-2xl mb-6">$ ACTIVE MODULES</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 町政ニュース */}
            <Link href="/announcements" className="border border-green-400 p-6 hover:bg-green-950 transition-colors">
              <h3 className="text-xl mb-2">町政ニュース</h3>
              <p className="text-green-600 mb-4">新得町の最新お知らせを自動収集・検索</p>
              <div className="text-sm">
                → 一覧を見る　<span className="text-green-600">20件収集済み</span>
              </div>
            </Link>

            {/* 広報しんとくアーカイブ */}
            <Link href="/newsletters" className="border border-green-400 p-6 hover:bg-green-950 transition-colors">
              <h3 className="text-xl mb-2">広報しんとくアーカイブ</h3>
              <p className="text-green-600 mb-4">広報誌PDF検索・全文検索</p>
              <div className="text-sm">
                → 一覧を見る　<span className="text-green-600">39件収集済み</span>
              </div>
            </Link>

            {/* イベントカレンダー */}
            <div className="border border-green-400 p-6 opacity-50">
              <h3 className="text-xl mb-2">イベントカレンダー</h3>
              <p className="text-green-600 mb-4">町内イベント情報の統合表示</p>
              <div className="text-sm text-green-600">
                開発中 ...
              </div>
            </div>

            {/* 議会情報 */}
            <div className="border border-green-400 p-6 opacity-50">
              <h3 className="text-xl mb-2">議会情報</h3>
              <p className="text-green-600 mb-4">議事録・質問・答弁データベース</p>
              <div className="text-sm text-green-600">
                開発中 ...
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <footer className="mt-12 pt-6 border-t border-green-400 text-green-600 text-sm">
          <p>AGPL-3.0 License | Non-partisan | Non-commercial</p>
        </footer>
      </div>
    </main>
  );
}
