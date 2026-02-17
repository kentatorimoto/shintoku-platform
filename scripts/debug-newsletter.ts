import * as cheerio from 'cheerio';
import axios from 'axios';

async function debug() {
  const url = 'https://www.shintoku-town.jp/gyousei/kouhou_koutyou/kohou_shintoku/kouhou/r7/';
  console.log(`Fetching: ${url}\n`);
  
  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Shintoku Platform Bot/1.0' }
  });
  
  const $ = cheerio.load(response.data);
  
  console.log('=== すべてのPDFリンク ===');
  $('a[href*=".pdf"]').each((i, el) => {
    const href = $(el).attr('href');
    const title = $(el).attr('title');
    const text = $(el).text();
    console.log(`${i + 1}. href: ${href}`);
    console.log(`   title: ${title}`);
    console.log(`   text: ${text}\n`);
  });
  
  console.log('\n=== title属性に"広報しんとく"を含むPDFリンク ===');
  $('a[href*=".pdf"][title*="広報しんとく"]').each((i, el) => {
    const href = $(el).attr('href');
    const title = $(el).attr('title');
    console.log(`${i + 1}. ${title}`);
    console.log(`   URL: ${href}\n`);
  });
}

debug().catch(console.error);
