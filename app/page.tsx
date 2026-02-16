import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <header className="mb-12 border-b border-green-400 pb-6">
          <h1 className="text-4xl mb-2">新得町オープンプラットフォーム</h1>
          <p className="text-green-300">OSPP - Open Shintoku Public Platform v0.1.0</p>
          <p className="text-sm text-green-600 mt-2">
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

        {/* モジュール一覧 */}
        <section className="mb-12">
          <h2 className="text-2xl mb-6 flex items-center">
            <span className="text-green-600 mr-2">$</span>
            ACTIVE MODULES
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* お知らせ */}
            <div className="border border-green-400 p-6 hover:bg-green-950 transition-colors">
              <h3 className="text-xl mb-2">町政ニュース</h3>
              <p className="text-green-600 text-sm mb-4">
                新得町の最新お知らせを自動収集・検索
              </p>
              <div className="flex gap-4 text-sm">
                <Link 
                  href="/announcements" 
                  className="text-green-400 hover:text-green-300 underline"
                >
                  → 一覧を見る
                </Link>
                <span className="text-green-600">20件収集済み</span>
              </div>
            </div>

            {/* 広報アーカイブ */}
            <div className="border border-green-400 p-6 opacity-50">
              <h3 className="text-xl mb-2">広報しんとくアーカイブ</h3>
              <p className="text-green-600 text-sm mb-4">
                広報誌PDF検索・全文検索
              </p>
              <div className="text-sm text-green-600">
                開発中...
              </div>
            </div>

            {/* イベント */}
            <div className="border border-green-400 p-6 opacity-50">
              <h3 className="text-xl mb-2">イベントカレンダー</h3>
              <p className="text-green-600 text-sm mb-4">
                町のイベント情報を統合表示
              </p>
              <div className="text-sm text-green-600">
                開発中...
              </div>
            </div>

            {/* 議会 */}
            <div className="border border-green-400 p-6 opacity-50">
              <h3 className="text-xl mb-2">議会情報</h3>
              <p className="text-green-600 text-sm mb-4">
                町議会の議事録・活動記録
              </p>
              <div className="text-sm text-green-600">
                開発中...
              </div>
            </div>
          </div>
        </section>

        {/* フッター */}
        <footer className="border-t border-green-400 pt-6 text-sm text-green-600">
          <div className="flex justify-between items-center">
            <div>
              <p>License: AGPL-3.0-or-later</p>
              <p>新得町の公開情報のみを使用</p>
            </div>
            <div className="text-right">
              <p>開発中のプロトタイプ</p>
              <p>役場・町民への負担なし</p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
