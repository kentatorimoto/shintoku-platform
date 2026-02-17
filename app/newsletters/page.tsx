import fs from 'fs';
import path from 'path';
import Link from 'next/link';

interface Newsletter {
  year: number;
  month: number;
  title: string;
  pdfUrl: string;
  size: string;
  format: string;
}

interface YearGroup {
  year: number;
  months: Newsletter[];
}

async function getNewsletters(): Promise<Newsletter[]> {
  try {
    const dataDir = path.join(process.cwd(), 'data', 'scraped');
    const files = fs.readdirSync(dataDir);

    const latestFile = files
      .filter(f => f.startsWith('newsletters-') && f.endsWith('.json'))
      .sort()
      .reverse()[0];

    if (!latestFile) {
      return [];
    }

    const filePath = path.join(dataDir, latestFile);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Failed to load newsletters:', error);
    return [];
  }
}

function groupByYear(newsletters: Newsletter[]): YearGroup[] {
  const map = new Map<number, Newsletter[]>();

  for (const nl of newsletters) {
    const group = map.get(nl.year) || [];
    group.push(nl);
    map.set(nl.year, group);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({
      year,
      months: months.sort((a, b) => b.month - a.month),
    }));
}

const MONTH_NAMES = [
  '', '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

export default async function NewslettersPage() {
  const newsletters = await getNewsletters();
  const yearGroups = groupByYear(newsletters);

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <header className="mb-8">
          <Link href="/" className="text-green-600 hover:text-green-400 mb-4 inline-block">
            ← トップに戻る
          </Link>
          <h1 className="text-4xl mb-2">広報しんとくアーカイブ</h1>
          <p className="text-green-600">
            広報誌PDFを年度別に一覧表示 | 全{newsletters.length}件
          </p>
        </header>

        {/* 統計情報 */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">TOTAL</div>
            <div className="text-2xl">{newsletters.length}件</div>
          </div>
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">YEARS</div>
            <div className="text-2xl">{yearGroups.length}年度分</div>
          </div>
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">SOURCE</div>
            <div className="text-lg">shintoku-town.jp</div>
          </div>
        </div>

        {/* 年度別一覧 */}
        {newsletters.length === 0 ? (
          <div className="border border-green-400 p-8 text-center">
            <p className="text-green-600">データがありません</p>
            <p className="text-sm text-green-700 mt-2">
              スクレイピングスクリプトを実行してください
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {yearGroups.map(group => (
              <section key={group.year}>
                <h2 className="text-2xl mb-4 flex items-center">
                  <span className="text-green-600 mr-2">$</span>
                  {group.year}年度（令和{group.year - 2018}年度）
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.months.map((nl, index) => (
                    <a
                      key={index}
                      href={nl.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-green-400 p-4 hover:bg-green-950 transition-colors block"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl">{MONTH_NAMES[nl.month]}号</span>
                        <span className="text-green-600 text-sm">{nl.format}</span>
                      </div>
                      <p className="text-sm text-green-600 mb-3 line-clamp-2">
                        {nl.title}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600">PDF {nl.size}</span>
                        <span className="text-green-400">開く →</span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* フッター */}
        <footer className="mt-12 border-t border-green-400 pt-6 text-sm text-green-600">
          <p>データソース: https://www.shintoku-town.jp/kouhou/</p>
          <p className="mt-2">最終更新: {new Date().toLocaleDateString('ja-JP')}</p>
        </footer>
      </div>
    </main>
  );
}
