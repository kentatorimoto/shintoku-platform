import Link from 'next/link';

export default function SourcesPage() {
  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <Link href="/" className="text-green-600 hover:text-green-400 mb-4 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl mb-2">Sources</h1>
          <p className="text-green-600">
            Public information used in this project
          </p>
          <p className="text-green-600">
            このサイトで使用している公開情報
          </p>
        </header>

        {/* Primary Sources */}
        <section className="mb-8">
          <h2 className="text-2xl mb-4 flex items-center">
            <span className="text-green-600 mr-2">$</span>
            PRIMARY SOURCES
          </h2>
          <div className="space-y-4">
            <div className="border border-green-400 p-6">
              <h3 className="text-lg mb-2">Shintoku Town &ndash; Council Live</h3>
              <a
                href="https://www.shintoku-town.jp/gyousei/gikai/gikailive/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 underline break-all"
              >
                https://www.shintoku-town.jp/gyousei/gikai/gikailive/
              </a>
            </div>
            <div className="border border-green-400 p-6">
              <h3 className="text-lg mb-2">YouTube &ndash; Special Committee Session</h3>
              <a
                href="https://www.youtube.com/watch?v=14_23_jU3pc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 underline break-all"
              >
                https://www.youtube.com/watch?v=14_23_jU3pc
              </a>
            </div>
          </div>
        </section>

        {/* Derived Materials */}
        <section className="mb-8">
          <h2 className="text-2xl mb-4 flex items-center">
            <span className="text-green-600 mr-2">$</span>
            DERIVED MATERIALS
          </h2>
          <div className="border border-green-400 p-6">
            <h3 className="text-lg mb-2">Shintoku 10-Year Plan Reality Check</h3>
            <p className="text-sm">
              Derived from the YouTube session using NotebookLM (slides).
            </p>
            <p className="text-green-600 text-sm">
              上記YouTube動画をNotebookLMで要約・スライド化した二次資料。
            </p>
          </div>
        </section>

        {/* Editorial Note */}
        <section>
          <h2 className="text-2xl mb-4 flex items-center">
            <span className="text-green-600 mr-2">$</span>
            EDITORIAL NOTE
          </h2>
          <div className="border border-green-400 p-6 space-y-2 text-sm">
            <p>This site summarizes and reorganizes publicly available information.</p>
            <p>For official statements, please refer to the primary sources above.</p>
            <p className="text-green-600 mt-2">
              本サイトは公開情報を要約・再編集しています。
            </p>
            <p className="text-green-600">
              正式な発表は一次情報をご確認ください。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
