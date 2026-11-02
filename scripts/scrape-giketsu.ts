import * as cheerio from "cheerio"
import axios from "axios"
import fs from "fs"
import path from "path"

import { readGiketsuPdf, type TableRow } from "./lib/giketsu-pdf"

const BASE = "https://www.shintoku-town.jp"
const INDEX_URL = `${BASE}/gyousei/gikai/giketsu/`

const HTTP_OPTS = {
  timeout: 30_000,
  headers: { "User-Agent": "ShintokuPlatformBot/1.0 (+https://github.com/shintoku-platform)" },
} as const

// ─────────────────────────── Interfaces ───────────────────────────

interface GiketsuItem {
  caseNumber: string    // "議案第1号" / "意見案第2号"
  caseType: string      // "議案" | "意見案"
  num: number
  title: string         // 件名
  decisionDate: string  // "3月14日"
  result: string        // "原案可決" など
}

interface GiketsuSession {
  pdfUrl: string
  year: number          // 2025
  eraLabel: string      // "令和7年"
  sessionLabel: string  // "定例第1回"
  sessionName: string   // "令和7年定例第1回"
  sessionRange: string  // "3月3日～3月19日" (あれば)
  items: GiketsuItem[]
  sessionId?: string    // 手で紐付けたセッションID。再生成でも引き継ぐ
}

interface PdfEntry {
  url: string
  sessionLabel: string
  eraLabel: string
  year: number
}

// ─────────────────────────── Helpers ──────────────────────────────

/** 全角英数・全角スペースを半角に正規化 */
function toHalfWidth(str: string): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .replace(/　/g, " ")
}

function eraToYear(type: "令和" | "平成", n: number): number {
  return type === "令和" ? 2018 + n : 1988 + n
}

// ─────────────────────────── PDF parsing ──────────────────────────

/** 表の行のうち、議案と意見案を索引の項目にする（報告・認定・選挙などは載せない） */
function toItems(rows: TableRow[]): GiketsuItem[] {
  const items: GiketsuItem[] = []
  for (const row of rows) {
    if (row.label !== "議案" && row.label !== "意見案") continue
    items.push({
      caseNumber: `${row.label}第${row.num}号`,
      caseType: row.label,
      num: row.num,
      title: row.title,
      decisionDate: row.date,
      result: row.result === "原案否決" ? "否決" : row.result,
    })
  }

  // 議案 → 意見案、番号昇順でソート
  return items.sort((a, b) => {
    if (a.caseType !== b.caseType) return a.caseType === "議案" ? -1 : 1
    return a.num - b.num
  })
}

/**
 * 「定例第2回 6月2日 6月2日 6月20日 ～ 6月21日 6月22日 3日」の行から会期を取り出す。
 * 列は 招集・開会・休会・閉会 の順。開会の欄は PDF によって閉会日が読めてしまうので、
 * 招集日（開会と同じ日）から、休会（「～」でつながる2つ）を除いた最後の日までとする
 */
function parseSessionRange(rawText: string): string {
  const hw = toHalfWidth(rawText)
  const line = hw.split(/\r?\n/).find((l) => /^\s*(定例|臨時)\s*第\s*\d+\s*回\s+\d+\s*月/.test(l))
  if (!line) return ""
  const dates = (line.replace(/\d+月\d+日\s*[～~]\s*\d+月\d+日/g, "").match(/\d+月\d+日/g) ?? [])
  return dates.length >= 2 ? `${dates[0]}～${dates[dates.length - 1]}` : ""
}

// ─────────────────────────── Crawling ─────────────────────────────

async function fetchYearPageUrls(): Promise<string[]> {
  console.log(`Fetching index: ${INDEX_URL}`)
  const { data: html } = await axios.get<string>(INDEX_URL, HTTP_OPTS)
  const $ = cheerio.load(html)

  const urls: string[] = []
  $("a").each((_i, el) => {
    const href = $(el).attr("href") ?? ""
    if (/\/giketsu\/(r|h)\d+\/$/.test(href)) {
      const full = href.startsWith("http") ? href : `${BASE}${href}`
      if (!urls.includes(full)) urls.push(full)
    }
  })

  return urls
}

async function fetchPdfEntriesFromYear(yearUrl: string): Promise<PdfEntry[]> {
  // URL から元号・年を取り出す (例: /r7/ → 令和7年=2025)
  const eraMatch = yearUrl.match(/\/(r(\d+)|h(\d+))\/$/)
  if (!eraMatch) return []

  let year: number
  let eraLabel: string
  if (eraMatch[2]) {
    const n = parseInt(eraMatch[2], 10)
    year = eraToYear("令和", n)
    eraLabel = `令和${n}年`
  } else {
    const n = parseInt(eraMatch[3], 10)
    year = eraToYear("平成", n)
    eraLabel = `平成${n}年`
  }

  console.log(`  Fetching year page: ${yearUrl}`)
  const { data: html } = await axios.get<string>(yearUrl, HTTP_OPTS)
  const $ = cheerio.load(html)

  const entries: PdfEntry[] = []

  $("a").each((_i, el) => {
    const $a = $(el)
    const href = $a.attr("href") ?? ""
    if (!/\.pdf$/i.test(href)) return

    const pdfUrl = href.startsWith("http") ? href : `${BASE}${href}`

    // 会議名をリンクテキスト or 親要素から抽出
    const linkText = $a.text()
    const contextText = $a.closest("li, tr, td, p, div").text()
    const searchText = `${linkText} ${contextText}`

    const sessionMatch = searchText.match(/(定例|臨時)\s*第\s*(\d+)\s*回/)
    const sessionLabel = sessionMatch
      ? `${sessionMatch[1]}第${sessionMatch[2]}回`
      : linkText.replace(/議決結果.*$/, "").replace(eraLabel, "").trim() ||
        "不明"

    entries.push({ url: pdfUrl, sessionLabel, eraLabel, year })
  })

  return entries
}

// ─────────────────────────── main ─────────────────────────────────

async function main() {
  const outDir = path.join(process.cwd(), "public", "data")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "giketsu_index.json")

  const previous: GiketsuSession[] = fs.existsSync(outPath)
    ? JSON.parse(fs.readFileSync(outPath, "utf-8"))
    : []
  const sessionIds = new Map(previous.map((s) => [s.pdfUrl, s.sessionId]))

  // A: 年度ページ一覧を取得
  const yearUrls = await fetchYearPageUrls()
  console.log(`Found ${yearUrls.length} year pages`)

  // A: 各年度ページから PDF エントリを収集
  const allPdfEntries: PdfEntry[] = []
  for (const yearUrl of yearUrls) {
    const entries = await fetchPdfEntriesFromYear(yearUrl)
    allPdfEntries.push(...entries)
  }
  console.log(`\nFound ${allPdfEntries.length} PDFs total`)

  // B: PDF をダウンロード→テキスト抽出→解析
  const sessions: GiketsuSession[] = []
  let successCount = 0
  let failCount = 0

  for (const entry of allPdfEntries) {
    const label = `${entry.eraLabel}${entry.sessionLabel}`
    console.log(`\n[fetch] ${label}`)
    console.log(`        ${entry.url}`)

    try {
      const resp = await axios.get<ArrayBuffer>(entry.url, {
        ...HTTP_OPTS,
        timeout: 120_000,
        responseType: "arraybuffer",
      })

      const buf = new Uint8Array(resp.data)
      const { rows, layoutText } = readGiketsuPdf(buf)
      const sessionRange = parseSessionRange(layoutText)
      const items = toItems(rows)
      for (const item of items) {
        if (!item.title || !item.decisionDate || !item.result) {
          console.warn(`  -> 読み取りが不完全: ${item.caseNumber} ${JSON.stringify(item)}`)
        }
      }
      const sessionId = sessionIds.get(entry.url)

      sessions.push({
        pdfUrl: entry.url,
        year: entry.year,
        eraLabel: entry.eraLabel,
        sessionLabel: entry.sessionLabel,
        sessionName: label,
        sessionRange,
        items,
        ...(sessionId ? { sessionId } : {}),
      })

      successCount++
      console.log(`  -> ${items.length} items extracted`)
    } catch (err) {
      failCount++
      console.error(
        `  -> FAILED: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // 年度降順、同年は会議名昇順でソート
  sessions.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return a.sessionLabel.localeCompare(b.sessionLabel, "ja")
  })

  // C: JSON 保存
  fs.writeFileSync(outPath, JSON.stringify(sessions, null, 2) + "\n")

  // ログサマリー
  const totalItems = sessions.reduce((s, sess) => s + sess.items.length, 0)
  console.log(`\n${"─".repeat(40)}`)
  console.log(`取得PDF数: ${allPdfEntries.length}`)
  console.log(`抽出件数:  ${totalItems}（${sessions.length} セッション）`)
  console.log(`失敗件数:  ${failCount}`)
  console.log(`出力先:    ${outPath}`)
}

main().catch((err) => {
  console.error("Scrape failed:", err)
  process.exit(1)
})
