import * as cheerio from "cheerio"
import { http } from "./lib/http"
import fs from "fs"
import path from "path"

const URL = "https://www.shintoku-town.jp/oshirase/"
const MAX_ITEMS = 20

interface Announcement {
  title: string
  date: string
  url: string
}

function parseJapaneseDate(text: string): string {
  const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!match) return ""
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

async function main() {
  console.log("Fetching:", URL)
  const { data: html } = await http.get<string>(URL)
  const $ = cheerio.load(html)

  const announcements: Announcement[] = []

  $("ul li").each((_i, el) => {
    if (announcements.length >= MAX_ITEMS) return false

    const $el = $(el)
    const $a = $el.find("a")
    const href = $a.attr("href")
    const title = $a.text().trim()

    if (!href || !href.startsWith("/oshirase/") || !title) return

    const dateText = $el.text()
    const date = parseJapaneseDate(dateText)
    if (!date) return

    announcements.push({
      title,
      date,
      url: `https://www.shintoku-town.jp${href}`,
    })
  })

  const outPath = path.join(process.cwd(), "data", "announcements.json")
  fs.writeFileSync(outPath, JSON.stringify(announcements, null, 2) + "\n")

  console.log(`Saved ${announcements.length} announcements to ${outPath}`)
}

main().catch((err) => {
  console.error("Scrape failed:", err)
  process.exit(1)
})
