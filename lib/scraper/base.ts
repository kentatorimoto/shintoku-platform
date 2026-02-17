import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScraperConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class BaseScraper {
  protected config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = {
      timeout: 10000,
      headers: {
        'User-Agent': 'Shintoku Platform Bot/1.0',
      },
      ...config,
    };
  }

  protected async fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
    try {
      const response = await axios.get(url, {
        timeout: this.config.timeout,
        headers: this.config.headers,
      });
      return cheerio.load(response.data) as unknown as cheerio.CheerioAPI;
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
