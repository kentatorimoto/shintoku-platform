// 町のサイトから広報しんとくの号の一覧を取り、data/koho/index.json を更新する。PDFは取らない。
//
//   npm run scrape:newsletters
//
// 号は増えるだけのはず。前回あった号が消えていたら、町のサイトの変化か読み取りの不具合なので、
// 一覧を書き換えずに失敗する（同期ごと止めて知らせる）。

import fs from "fs"
import path from "path"
import * as cheerio from "cheerio"
import { http } from "./lib/http"
import { isKohoIssueTitle, kohoKey, parseKohoDate, type KohoIssue, type KohoKind } from "./lib/koho-issue"

const BASE = "https://www.shintoku-town.jp"
const ROOT_PATH = "/gyousei/kouhou_koutyou/kohou_shintoku"
const SECTIONS: { path: string; kind: KohoKind }[] = [
  { path: "kouhou", kind: "monthly" },
  { path: "osirase", kind: "oshirase" },
]
const INDEX_PATH = path.join(process.cwd(), "data", "koho", "index.json")
const FETCH_INTERVAL_MS = 500

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function yearPages(section: string): Promise<string[]> {
  const url = `${BASE}${ROOT_PATH}/${section}/`
  const $ = cheerio.load((await http.get<string>(url)).data)
  const re = new RegExp(`/${section}/[rh]\\d+[^/]*/$`)
  const links = new Set<string>()
  $("a").each((_, el) => {
    const href = $(el).attr("href") ?? ""
    if (re.test(href)) links.add(new URL(href, BASE).href)
  })
  return [...links]
}

async function issuesOf(url: string, kind: KohoKind): Promise<{ title: string; url: string }[]> {
  const $ = cheerio.load((await http.get<string>(url)).data)
  const byUrl = new Map<string, string>()
  $("a[href$='.pdf']").each((_, el) => {
    const a = $(el)
    const href = new URL(a.attr("href") ?? "", BASE).href
    let title = (a.attr("title") || a.text()).replace(/\s+/g, " ").trim()
    // 題名の無いリンクは、属する節の見出し（令和7年5月号（2025年））とファイル名で読む
    if (!title) {
      const heading = a.closest("section, div, li").prevAll("h2").first().text().trim()
        || a.parents().prevAll("h2").first().text().trim()
      const file = path.basename(new URL(href).pathname)
      title = heading ? `${heading} ${/a3/i.test(file) ? "A3" : "A4"}` : ""
    }
    if (title && !byUrl.has(href)) byUrl.set(href, title)
  })
  return [...byUrl].flatMap(([href, title]) => (isKohoIssueTitle(title) && (kind === "monthly" ? !title.includes("お知らせ") : true))
    ? [{ title, url: href }] : [])
}

async function main() {
  const previous: KohoIssue[] = fs.existsSync(INDEX_PATH) ? JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8")) : []
  const previousByKey = new Map(previous.map(i => [i.key, i]))
  const found = new Map<string, KohoIssue>()
  const duplicates: string[] = []

  for (const { path: section, kind } of SECTIONS) {
    const pages = await yearPages(section)
    if (pages.length === 0) throw new Error(`年度ページが見つかりません: ${section}`)
    for (const page of pages) {
      await sleep(FETCH_INTERVAL_MS)
      for (const { title, url } of await issuesOf(page, kind)) {
        const d = parseKohoDate(title)
        if (!d) continue
        const key = kohoKey(kind, d.year, d.month)
        if (found.has(key)) {
          if (found.get(key)?.url !== url) duplicates.push(`${key}: ${title} ${url}`)
          continue
        }
        const prev = previousByKey.get(key)
        const same = prev?.url === url
        found.set(key, {
          key, kind, title,
          date: `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day ?? 1).padStart(2, "0")}`,
          year: d.year, month: d.month, url,
          status: same && prev ? prev.status : "pending",
          pages: same && prev ? prev.pages : null,
          chars: same && prev ? prev.chars : null,
          blankPages: same && prev ? prev.blankPages : [],
        })
      }
    }
  }

  const lost = previous.filter(i => !found.has(i.key)).map(i => i.key)
  if (lost.length > 0) {
    console.error(`❌ 前回あった号が見つかりません（${lost.length} 号）: ${lost.join(", ")}`)
    console.error("一覧は更新していません。町のサイトの変更か、読み取りの不具合を確認してください。")
    process.exit(1)
  }

  const issues = [...found.values()].sort((a, b) => a.key.localeCompare(b.key))
  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true })
  fs.writeFileSync(INDEX_PATH, `[\n${issues.map(i => JSON.stringify(i)).join(",\n")}\n]\n`)

  const count = (k: KohoKind) => issues.filter(i => i.kind === k).length
  console.log(`✅ 月号 ${count("monthly")} / お知らせ号 ${count("oshirase")} / 未取得 ${issues.filter(i => i.status === "pending").length}`)
  if (duplicates.length > 0) {
    console.log(`同じ月に別のPDFがある（先に見つけた方を採用）: ${duplicates.length} 件`)
    duplicates.forEach(d => console.log(`  ${d}`))
  }
}

main().catch((err) => {
  console.error("Scrape failed:", err)
  process.exit(1)
})
