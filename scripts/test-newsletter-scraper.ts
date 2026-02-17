import { NewsletterScraper } from '../lib/scraper/newsletters';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('広報しんとくPDFスクレイパー テスト開始...\n');
  
  const scraper = new NewsletterScraper();
  
  // 最新3年分のPDFを取得
  const newsletters = await scraper.scrapeLatestYears(3);
  
  console.log(`\n✅ 取得完了: ${newsletters.length}件のPDF\n`);
  
  // A4版のみフィルタリング（サイズが小さいため）
  const a4Newsletters = newsletters.filter(n => n.format === 'A4');
  
  // 結果を表示
  console.log('=== 広報しんとく（A4版のみ） ===\n');
  a4Newsletters.slice(0, 10).forEach(newsletter => {
    console.log(`📄 ${newsletter.title}`);
    console.log(`   URL: ${newsletter.pdfUrl}`);
    console.log(`   サイズ: ${newsletter.size}\n`);
  });
  
  // JSONファイルに保存
  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = path.join('data', 'scraped', `newsletters-${timestamp}.json`);
  
  fs.writeFileSync(
    outputPath,
    JSON.stringify(a4Newsletters, null, 2),
    'utf-8'
  );
  
  console.log(`\n💾 保存完了: ${outputPath}`);
  console.log(`📊 合計: ${a4Newsletters.length}件（A4版のみ）`);
}

main().catch(console.error);
