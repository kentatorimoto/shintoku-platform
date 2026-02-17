import { BaseScraper } from './base';

export interface Announcement {
  title: string;
  date: string;
  category: string;
  url: string;
  isNew?: boolean;
}

export class AnnouncementScraper extends BaseScraper {
  async scrapeList(): Promise<Announcement[]> {
    const url = `${this.config.baseUrl}/oshirase/`;
    console.log(`Scraping announcements from: ${url}`);
    
    const $ = await this.fetchHtml(url);
    const announcements: Announcement[] = [];

    // 新得町のお知らせページの構造
    $('.home-info-item, li.home-info-item').each((_, element) => {
      const $el = $(element);
      
      // タイトルとURLを取得
      const $link = $el.find('a.home-info-link, a').first();
      const title = $link.text().trim();
      const href = $link.attr('href') || '';
      
      // カテゴリを取得
      const $label = $el.find('.home-info-label');
      const categoryText = $label.contents().filter(function(this: { type: string }) {
        return this.type === 'text';
      }).text().trim();
      
      // newラベルがあるかチェック
      const isNew = $label.find('.upper-case.new, .new').length > 0;
      
      // 日付を取得（テキストから抽出）
      const fullText = $el.text();
      const dateMatch = fullText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日|(\d{1,2})月(\d{1,2})日/);
      let date = '';
      if (dateMatch) {
        date = dateMatch[0];
      }

      if (title && href) {
        announcements.push({
          title,
          date,
          category: categoryText,
          url: href.startsWith('http') ? href : `${this.config.baseUrl}${href}`,
          isNew,
        });
      }
    });

    console.log(`Found ${announcements.length} announcements`);
    return announcements;
  }

  async scrapeDetail(url: string): Promise<string> {
    const $ = await this.fetchHtml(url);
    const content = $('article, .entry-content, .content, main').first().text().trim();
    return content;
  }
}
