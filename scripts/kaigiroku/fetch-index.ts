// 町の会議録ページから、全年の会議一覧を data/kaigiroku/index.json に保存する。
//
//   npm run kaigiroku:index
//
// PDFは取得しない。URLの一覧だけを持つ。

import fs from "fs"
import path from "path"
import * as cheerio from "cheerio"
import { http } from "../lib/http"

const BASE = "https://www.shintoku-town.jp"
const TOP_PATH = "/gyousei/gikai/kaigiroku/"
const OUT_PATH = path.join(process.cwd(), "data", "kaigiroku", "index.json")
const FETCH_INTERVAL_MS = 1_000

export interface KaigirokuEntry {
  /** 年の索引ページのslug（r8 / h31r1 など） */
  year: string
  yearLabel: string
  /** 町のページの表記そのまま（例: `定例第2回(R8.6.3～R8.6.19)`） */
  title: string
  pdfUrl: string
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  const top = cheerio.load((await http.get<string>(BASE + TOP_PATH)).data)

  const years = new Map<string, string>()
  top(`a[href^="${TOP_PATH}"]`).each((_, el) => {
    const href = top(el).attr("href") ?? ""
    const slug = /\/kaigiroku\/([^/]+)\/$/.exec(href)?.[1]
    if (slug) years.set(slug, top(el).text().trim())
  })

  const entries: KaigirokuEntry[] = []
  for (const [year, yearLabel] of years) {
    await sleep(FETCH_INTERVAL_MS)
    const page = cheerio.load((await http.get<string>(`${BASE}${TOP_PATH}${year}/`)).data)
    const before = entries.length
    page('a[href$=".pdf"]').each((_, el) => {
      const a = page(el)
      entries.push({
        year,
        yearLabel,
        title: a.text().trim(),
        pdfUrl: new URL(a.attr("href") ?? "", BASE).href,
      })
    })
    console.log(`${yearLabel}: ${entries.length - before} 本`)
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2) + "\n")
  console.log(`\n✅ ${years.size} 年分・${entries.length} 本 → ${path.relative(process.cwd(), OUT_PATH)}`)
}

main().catch((err) => {
  console.error("fetch-index failed:", err)
  process.exit(1)
})
