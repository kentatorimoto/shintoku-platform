import { AnnouncementScraper } from '../lib/scraper/announcements';

async function main() {
  console.log('🚀 新得町お知らせスクレイピングテスト開始\n');

  const scraper = new AnnouncementScraper({
    baseUrl: process.env.BASE_URL || 'https://www.shintoku-town.jp',
  });

  try {
    const announcements = await scraper.scrapeList();
    
    console.log(`\n✅ ${announcements.length}件のお知らせを取得しました\n`);
    
    // 最初の5件を表示
    announcements.slice(0, 5).forEach((announcement, index) => {
      console.log(`${index + 1}. ${announcement.title}`);
      console.log(`   日付: ${announcement.date}`);
      console.log(`   カテゴリ: ${announcement.category}`);
      console.log(`   URL: ${announcement.url}`);
      console.log('');
    });

    // JSON形式で保存
    const fs = require('fs');
    const path = require('path');
    
    const outputDir = path.join(process.cwd(), 'data', 'scraped');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `announcements-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(announcements, null, 2), 'utf-8');
    
    console.log(`💾 データを保存しました: ${outputFile}`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
