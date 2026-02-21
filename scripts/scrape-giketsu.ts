import * as cheerio from "cheerio"
import axios from "axios"
import fs from "fs"
import path from "path"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse")

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

async function getPdfText(buf: Uint8Array): Promise<string> {
  const parser = new PDFParse(buf, { verbosity: 0 })
  try {
    const result = await parser.getText()
    const pages: Array<{ text: string }> = result.pages ?? []
    return pages.map((p) => p.text).join("\n")
  } finally {
    parser.destroy()
  }
}

const RESULT_KEYWORDS = [
  "原案可決", "修正可決", "否決", "撤回",
  "継続審査", "委員会付託", "不採択", "採択", "廃案", "取り下げ",
]

/** 議決結果行かどうかを判定 */
function isResultLine(line: string): boolean {
  return (
    /(議案|意見案)\s*第\s*(\d+)\s*号/.test(line) &&
    /(\d{1,2})\s*月\s*(\d{1,2})\s*日/.test(line) &&
    RESULT_KEYWORDS.some((kw) => line.includes(kw))
  )
}

/**
 * 件名候補行でない（構造ヘッダ・文書番号など）かを判定
 *
 * PDFには「議案番号 議決月日 議決結果」「件 名」「令和 7 年 ３月19日」など
 * 構造的な行が件名ブロックの前後に現れるため除外する。
 */
function isTitleCandidate(line: string): boolean {
  // 「件 名」単独ヘッダ
  if (/^件\s*名$/.test(line)) return false
  // 列ヘッダ「議案番号 議決月日 議決結果...」
  if (/^議案番号[\s]/.test(line)) return false
  // 会議サマリー行「定例第1回 3月3日 3月19日 ...」
  if (/^(定例|臨時)第\d+回\s+\d+月\d+日/.test(line)) return false
  // 文書番号「新 議 号」
  if (/^新\s+議\s+号/.test(line)) return false
  // スペース入り日付「令和 7 年 3 月...」（報告書ヘッダ）
  if (/^令和\s+\d+\s+年/.test(line)) return false
  // 宛先・差出人
  if (/^新\s+得\s+町\s+長/.test(line)) return false
  if (/^新得町議会議長\s/.test(line)) return false
  // 文書タイトル
  if (/新得町議会議決結果報告/.test(line)) return false
  // 休会期間「3月4日 ～ 3月12日」
  if (/^\d+月\d+日\s*[～~]/.test(line)) return false
  // 期間ヘッダ
  if (/^(招集月日|開会月日|閉会月日|会議日数|休会月日)/.test(line)) return false
  return true
}

/**
 * 件名テキスト行列から完全な件名を再構成する。
 *
 * PDFのページ幅で行が途中切断されるため、日本語の典型的な文末パターンで
 * 区切りを判断し複数行を1件名に結合する。
 */
const TITLE_END_RE =
  /について$|予算$|件$|）$|\)$|意見書$|こと$|ため$|同意$|よる$|など$|承認$|承諾$/

function reconstructTitles(lines: string[]): string[] {
  const titles: string[] = []
  let current = ""

  for (const line of lines) {
    current = current ? current + line : line

    if (TITLE_END_RE.test(current) || current.length > 120) {
      titles.push(current.trim())
      current = ""
    }
  }

  if (current) titles.push(current.trim())
  return titles
}

/**
 * PDF全文テキストから議案データを抽出する。
 *
 * PDFは以下のブロック構成を繰り返す:
 *   [結果ブロック] 議案第n号 n月n日 原案可決  ← case# + date + result
 *   [件名ブロック] （議案番号なし）件名テキスト  ← 結果と同順で並ぶ
 *
 * 結果ブロックと件名ブロックを位置順にマッピングし1件ずつ対応付ける。
 */
function parsePdfText(rawText: string): {
  sessionRange: string
  items: GiketsuItem[]
} {
  const hw = toHalfWidth(rawText)
  const lines = hw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  // ── 会期の抽出 ──────────────────────────────────────────────────
  // 「定例第1回 3月3日 3月19日 ...」形式の行から開会～閉会を取得
  let sessionRange = ""
  for (const line of lines) {
    const m = line.match(/(定例|臨時)第\d+回\s+(\d+月\d+日)\s+(\d+月\d+日)/)
    if (m) {
      sessionRange = `${m[2]}～${m[3]}`
      break
    }
  }
  // フォールバック: 「会期 ...」形式
  if (!sessionRange) {
    const m = hw.match(/会\s*期\s+([^\n]+)/)
    if (m) sessionRange = m[1].trim()
  }

  // ── ステートマシン: (結果ブロック, 件名行) ペアを収集 ──────────────
  type ResultEntry = {
    caseType: string
    caseNum: number
    decisionDate: string
    result: string
  }
  const segments: Array<{ results: ResultEntry[]; titleLines: string[] }> = []
  let currentResults: ResultEntry[] = []
  let currentTitleLines: string[] = []
  let state: "INIT" | "RESULTS" | "TITLES" = "INIT"

  for (const line of lines) {
    if (isResultLine(line)) {
      if (state === "TITLES") {
        // 前セグメントを確定して新セグメント開始
        segments.push({ results: currentResults, titleLines: currentTitleLines })
        currentResults = []
        currentTitleLines = []
      }
      state = "RESULTS"

      const cm = line.match(/(議案|意見案)\s*第\s*(\d+)\s*号/)!
      const dm = line.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)!
      const rw = RESULT_KEYWORDS.find((kw) => line.includes(kw))!

      currentResults.push({
        caseType: cm[1],
        caseNum: parseInt(cm[2], 10),
        decisionDate: `${dm[1]}月${dm[2]}日`,
        result: rw,
      })
    } else {
      if (state === "RESULTS") state = "TITLES"
      if (state === "TITLES" && isTitleCandidate(line)) {
        currentTitleLines.push(line)
      }
    }
  }

  // 最終セグメントを保存
  if (currentResults.length > 0 || currentTitleLines.length > 0) {
    segments.push({ results: currentResults, titleLines: currentTitleLines })
  }

  // ── 結果と件名を位置順でマッピング ───────────────────────────────
  const items: GiketsuItem[] = []

  for (const seg of segments) {
    const titles = reconstructTitles(seg.titleLines)

    seg.results.forEach((res, i) => {
      items.push({
        caseNumber: `${res.caseType}第${res.caseNum}号`,
        caseType: res.caseType,
        num: res.caseNum,
        title: titles[i] ?? "",
        decisionDate: res.decisionDate,
        result: res.result,
      })
    })
  }

  // 議案 → 意見案、番号昇順でソート
  items.sort((a, b) => {
    if (a.caseType !== b.caseType) return a.caseType === "議案" ? -1 : 1
    return a.num - b.num
  })

  return { sessionRange, items }
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
      const rawText = await getPdfText(buf)
      const { sessionRange, items } = parsePdfText(rawText)

      sessions.push({
        pdfUrl: entry.url,
        year: entry.year,
        eraLabel: entry.eraLabel,
        sessionLabel: entry.sessionLabel,
        sessionName: label,
        sessionRange,
        items,
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
