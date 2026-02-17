import Link from 'next/link';

export default function ProcessPage() {
  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <Link href="/" className="text-green-600 hover:text-green-400 mb-4 inline-block">
            ← トップに戻る
          </Link>
          <h1 className="text-4xl mb-2">Process Atlas</h1>
          <p className="text-green-600">
            町の課題・議論・計画策定の流れを可視化
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/process/priorities" className="border border-green-400 p-6 hover:bg-green-950 transition-colors">
            <h2 className="text-2xl mb-2 flex items-center">
              <span className="text-green-600 mr-2">$</span>
              TOWN PRIORITIES
            </h2>
            <p className="text-green-600 mb-4">Current policy discussions and focus areas</p>
            <div className="text-sm">
              → View priorities　<span className="text-green-600">5 categories</span>
            </div>
          </Link>

          <Link href="/process/timeline" className="border border-green-400 p-6 hover:bg-green-950 transition-colors">
            <h2 className="text-2xl mb-2 flex items-center">
              <span className="text-green-600 mr-2">$</span>
              DECISION TIMELINE
            </h2>
            <p className="text-green-600 mb-4">Key milestones in the planning process</p>
            <div className="text-sm">
              → View timeline　<span className="text-green-600">4 milestones</span>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
