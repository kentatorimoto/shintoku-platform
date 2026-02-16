import fs from 'fs';
import path from 'path';
import Link from 'next/link';

interface Announcement {
  title: string;
  date: string;
  category: string;
  url: string;
  isNew?: boolean;
}

async function getAnnouncements(): Promise<Announcement[]> {
  try {
    const dataDir = path.join(process.cwd(), 'data', 'scraped');
    const files = fs.readdirSync(dataDir);
    
    // 最新のJSONファイルを取得
    const latestFile = files
      .filter(f => f.startsWith('announcements-') && f.endsWith('.json'))
      .sort()
      .reverse()[0];
    
    if (!latestFile) {
      return [];
    }
    
    const filePath = path.join(dataDir, latestFile);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Failed to load announcements:', error);
    return [];
  }
}

export default async function AnnouncementsPage() {
  const announcements = await getAnnouncements();
  
  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <header className="mb-8">
          <Link href="/" className="text-green-600 hover:text-green-400 mb-4 inline-block">
            ← トップに戻る
          </Link>
          <h1 className="text-4xl mb-2">町政ニュース</h1>
          <p className="text-green-600">
            新得町公式サイトから自動収集 | 全{announcements.length}件
          </p>
        </header>

        {/* 統計情報 */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">TOTAL</div>
            <div className="text-2xl">{announcements.length}件</div>
          </div>
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">NEW</div>
            <div className="text-2xl">
              {announcements.filter(a => a.isNew).length}件
            </div>
          </div>
          <div className="border border-green-400 p-4">
            <div className="text-green-600 text-sm mb-1">SOURCE</div>
            <div className="text-lg">shintoku-town.jp</div>
          </div>
        </div>

        {/* お知らせ一覧 */}
        <section>
          <h2 className="text-2xl mb-6 flex items-center">
            <span className="text-green-600 mr-2">$</span>
            ANNOUNCEMENTS
          </h2>

          {announcements.length === 0 ? (
            <div className="border border-green-400 p-8 text-center">
              <p className="text-green-600">データがありません</p>
              <p className="text-sm text-green-700 mt-2">
                スクレイピングスクリプトを実行してください
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement, index) => (
                <div 
                  key={index}
                  className="border border-green-400 p-6 hover:bg-green-950 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {announcement.isNew && (
                          <span className="bg-green-400 text-black px-2 py-1 text-xs font-bold">
                            NEW
                          </span>
                        )}
                        {announcement.category && (
                          <span className="text-green-600 text-sm">
                            [{announcement.category}]
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl mb-2">
                        {announcement.title || '（タイトルなし）'}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-green-600">
                      {announcement.date || '日付不明'}
                    </div>
                    <a 
                      href={announcement.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 underline"
                    >
                      詳細を見る →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* フッター */}
        <footer className="mt-12 border-t border-green-400 pt-6 text-sm text-green-600">
          <p>データソース: https://www.shintoku-town.jp/oshirase/</p>
          <p className="mt-2">最終更新: {new Date().toLocaleDateString('ja-JP')}</p>
        </footer>
      </div>
    </main>
  );
}
