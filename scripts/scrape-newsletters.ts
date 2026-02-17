import axios from "axios"
import * as cheerio from "cheerio"
import fs from "fs"
import path from "path"

const BASE = "https://www.shintoku-town.jp"
const INDEX_URL = `${BASE}/gyousei/kouhou_koutyou/kohou_shintoku/kouhou/`
const MAX_ITEMS = 50

interface Newsletter {
  title: string
  date: string
  url: string
  format: "pdf"
  sizeBytes?: number
}

/** 令和N年 → 西暦 */
function reiwaTtoYear(n: number): number {
  return 2018 + n
}

/** "令和6年4月15日号" → "2024-04-15", "令和7年4月号" → "2025-04-01" */
function parseEraDate(text: string): string {
  const match = text.match(/令和(\d+)年(\d{1,2})月(\d{1,2})日/)
  if (match) {
    const [, era, month, day] = match
    const year = reiwaTtoYear(Number(era))
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  const monthOnly = text.match(/令和(\d+)年(\d{1,2})月/)
  if (monthOnly) {
    const [, era, month] = monthOnly
    const year = reiwaTtoYear(Number(era))
    return `${year}-${month.padStart(2, "0")}-01`
  }
  return ""
}

/** "13MB" → bytes, "547KB" → bytes */
function parseSizeBytes(text: string): number | undefined {
  const match = text.match(/([\d.]+)\s*(MB|KB)/i)
  if (!match) return undefined
  const value = parseFloat(match[1])
  return match[2].toUpperCase() === "MB"
    ? Math.round(value * 1024 * 1024)
    : Math.round(value * 1024)
}

async function fetchYearLinks(): Promise<string[]> {
  console.log("Fetching index:", INDEX_URL)
  const { data: html } = await axios.get<string>(INDEX_URL)
  const $ = cheerio.load(html)

  const yearLinks: string[] = []
  $("a").each((_i, el) => {
    const href = $(el).attr("href")
    if (href && /\/kouhou\/r\d+\/$/.test(href)) {
      const fullUrl = href.startsWith("http") ? href : `${BASE}${href}`
      if (!yearLinks.includes(fullUrl)) {
        yearLinks.push(fullUrl)
      }
    }
  })

  return yearLinks
}

async function fetchNewslettersFromYear(url: string): Promise<Newsletter[]> {
  console.log("Fetching year page:", url)
  const { data: html } = await axios.get<string>(url)
  const $ = cheerio.load(html)

  const results: Newsletter[] = []

  $("a[href$='.pdf']").each((_i, el) => {
    const $a = $(el)
    const linkText = $a.text().trim()

    // Only pick main 広報しんとく issues (A4 version)
    if (!linkText.includes("広報しんとく")) return
    if (!linkText.includes("A4")) return

    const href = $a.attr("href")!
    const pdfUrl = href.startsWith("http") ? href : `${BASE}${href}`

    const date = parseEraDate(linkText)
    if (!date) return

    // Try to extract size from surrounding text
    const parentText = $a.parent().text()
    const sizeBytes = parseSizeBytes(parentText)

    const entry: Newsletter = {
      title: linkText.replace(/\s+/g, " ").replace(/（A4）?/, "").trim(),
      date,
      url: pdfUrl,
      format: "pdf",
    }
    if (sizeBytes) entry.sizeBytes = sizeBytes

    results.push(entry)
  })

  return results
}

async function main() {
  const yearLinks = await fetchYearLinks()
  console.log(`Found ${yearLinks.length} year pages`)

  const all: Newsletter[] = []

  for (const yearUrl of yearLinks) {
    if (all.length >= MAX_ITEMS) break
    const items = await fetchNewslettersFromYear(yearUrl)
    all.push(...items)
  }

  // Trim to max and sort by date descending
  const newsletters = all
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_ITEMS)

  const outPath = path.join(process.cwd(), "data", "newsletters.json")
  fs.writeFileSync(outPath, JSON.stringify(newsletters, null, 2) + "\n")

  console.log(`Saved ${newsletters.length} newsletters to ${outPath}`)
}

main().catch((err) => {
  console.error("Scrape failed:", err)
  process.exit(1)
})
