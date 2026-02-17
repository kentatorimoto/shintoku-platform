import * as cheerio from 'cheerio';
import axios from 'axios';

export interface Newsletter {
  year: number;
  month: number;
  title: string;
  pdfUrl: string;
  size: string;
  format: 'A4' | 'A3';
}

export class NewsletterScraper {
  private userAgent = 'Shintoku Platform Bot/1.0';
  
  // 西暦から令和年号に変換
  private toReiwaYear(year: number): string {
    const reiwaYear = year - 2018;
    return `r${reiwaYear}`;
  }
  
  async scrapeYear(year: number): Promise<Newsletter[]> {
    const newsletters: Newsletter[] = [];
    const reiwaYear = this.toReiwaYear(year);
    const yearUrl = `https://www.shintoku-town.jp/gyousei/kouhou_koutyou/kohou_shintoku/kouhou/${reiwaYear}/`;
    
    console.log(`  URL: ${yearUrl}`);
    
    try {
      const response = await axios.get(yearUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // titleに「広報しんとく」を含むPDFリンクを探す
      $('a[href*=".pdf"][title*="広報しんとく"]').each((_, element) => {
        const href = $(element).attr('href');
        const title = $(element).attr('title') || '';
        
        if (!href) return;
        
        // URLを絶対パスに変換
        const pdfUrl = href.startsWith('http') 
          ? href 
          : `https://www.shintoku-town.jp${href}`;
        
        // ファイルサイズを取得
        const sizeText = $(element).parent().text();
        const sizeMatch = sizeText.match(/(\d+)MB/);
        const size = sizeMatch ? `${sizeMatch[1]}MB` : '不明';
        
        // フォーマット（A4/A3）を判定
        const format = (title.includes('A3') || href.includes('A3')) ? 'A3' : 'A4';
        
        // 月を抽出（URLから）
        const monthMatch = href.match(/(\d{4})\.(\d{1,2})/);
        if (monthMatch) {
          const month = parseInt(monthMatch[2]);
          
          newsletters.push({
            year,
            month,
            title,
            pdfUrl,
            size,
            format
          });
        }
      });
      
      console.log(`  取得: ${newsletters.length}件`);
      return newsletters;
    } catch (error) {
      console.error(`Error scraping year ${year}:`, error);
      return [];
    }
  }
  
  async scrapeLatestYears(yearsCount: number = 3): Promise<Newsletter[]> {
    const currentYear = new Date().getFullYear();
    const newsletters: Newsletter[] = [];
    
    for (let i = 0; i < yearsCount; i++) {
      const year = currentYear - i;
      console.log(`\nScraping newsletters for ${year}...`);
      
      const yearNewsletters = await this.scrapeYear(year);
      newsletters.push(...yearNewsletters);
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
    }
    
    return newsletters;
  }
}
