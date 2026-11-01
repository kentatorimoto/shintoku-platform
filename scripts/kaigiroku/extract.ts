// 会議録PDFを一時取得して pdftotext にかけ、全文と発言単位の分割を保存する。PDF自体は保存しない。
//
//   npm run kaigiroku:extract -- [--all] [--cache <リポジトリ外のdir>]
//
//   content/kaigiroku/{sessionKey}/raw.txt        全文（Layer 0。ページ境界は \f）
//   content/kaigiroku/{sessionKey}/speeches.json  [{agenda, speaker, role, date, page, text}]
//   data/kaigiroku/session-map.json               会議録 ⇔ 既存セッションの対応
//   data/kaigiroku/extract-report.json            分割できなかった箇所
//
// 既定は令和分だけ。--all で平成分も含める。page はPDFの物理ページ（URLの #page=N と一致）。

import { execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import { http } from "../lib/http"
import type { KaigirokuEntry } from "./fetch-index"

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, "content", "kaigiroku")
const DATA_DIR = path.join(ROOT, "data", "kaigiroku")
const SESSIONS_DIR = path.join(ROOT, "content", "sessions")
const FETCH_INTERVAL_MS = 1_000
/** これを超える発言は、見出しや名簿を巻き込んだ分割ミスの疑いとして報告する */
const LONG_SPEECH_CHARS = 12_000

export interface Speech {
  agenda: string
  speaker: string
  role: string
  /** YYYY-MM-DD。会期が複数日にわたるので出典の日付に要る */
  date: string
  page: number
  text: string
}

// ── 文字の正規化 ────────────────────────────────────────────────────────────

const WIDE = "\\u3000-\\u30ff\\u3400-\\u9fff\\uff00-\\uffef"
const WIDE_GAP = new RegExp(`([${WIDE}]) +(?=[${WIDE}])`, "g")

/** 全角文字どうしの空白を潰す。発言行の「◎氏名役職 本文」の区切りだけは残す。 */
export function normalizeLine(line: string): string {
  const collapsed = line.replace(/\u3000/g, " ").replace(WIDE_GAP, "$1").replace(/ +/g, " ").trim()
  const speech = parseSpeechLine(collapsed)
  return speech ? `◎${speech.speaker}${speech.role} ${speech.text}`.trimEnd() : collapsed
}

const toHalf = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))

// ── 発言者 ──────────────────────────────────────────────────────────────────

/** 姓名のあとに続く、役職の書き出し。最も手前で当たった位置を姓名の終わりとする */
const ROLE_HEAD = /(副町長|町長|教育長|副議長|議長|議員|議会|臨時|副委員長|委員長|委員|監査|総務|企画|財政|まちづくり|地域|域戦略|税務|出納|会計|町民|住民|保健|福祉|保育|庶務|医療|病院|施設|建設|水道|農林|農政|農業|産業|商工|観光|林業|児童|子育て|学校|社会|教育|屈足|事務局|消防|署長|環境|政策|参事|主幹|主査|課長|室長|所長|局長|係長|次長|代表|参考人|説明員)/

/** 役職の終わり。平成の会議録は役職と本文のあいだに区切りが無い行があるので、語彙で切る */
const ROLE_END = /^[\u3040-\u30ff\u3400-\u9fff]{0,14}?(副町長|町長|教育長|副議長|議長|議員|副委員長|委員長|委員(?!会事務|会局|会長)|課長|室長|署長|所長|局長|センター長|園長|参事|主幹|主査|係長|次長|参考人|説明員)(補佐|代理者?)?/

/** 姓名に使わない文字。日程番号や「◎諸般の報告」を発言者と読まないため */
const NOT_NAME = /[0-9０-９の、。（）・]|^日程/
const MAX_NAME_CHARS = 6

/** 正規化済みの1行が発言の書き出しなら、発言者・役職・本文に分ける */
export function parseSpeechLine(line: string): { speaker: string; role: string; text: string } | null {
  if (!line.startsWith("◎")) return null
  // 町の組版の崩れ（実例: `◎委青柳茂行員長`）を元に戻す
  const body = line.slice(1).trimStart().replace(/^委(.{2,5}?)員長/, "$1委員長")
  const head = ROLE_HEAD.exec(body)
  if (!head || head.index === 0 || head.index > MAX_NAME_CHARS) return null
  const speaker = body.slice(0, head.index)
  if (NOT_NAME.test(speaker)) return null
  const end = ROLE_END.exec(body.slice(head.index))
  if (!end) return null
  const text = body.slice(head.index + end[0].length).trim()
  // 「◎追加日程議長の常任委員辞任について」のような見出しを発言と読まない
  if (text.startsWith("の")) return null
  return { speaker, role: end[0], text }
}

// ── 分割 ────────────────────────────────────────────────────────────────────

interface Anomaly { page: number; kind: string; line: string }

const PAGE_NUMBER = /^[-－ー―]\s*[0-9０-９]+\s*[-－ー―]$/
const DAY_HEADER = /^(令和|平成)([元0-9０-９]+)年([0-9０-９]+)月([0-9０-９]+)日[（(]/
const SESSION_TITLE = /(議会|委員会).*(（第.+号）|第.+号|会議録)$/
const SIGNATURE = /(上記会議の経過|ここに署名する|署名する。?$)/
const STAGE = /^[［\[].*(登壇|降壇)[］\]]$/
const AGENDA_WORD = /^◎(日程第|開|閉|散|休|延|諸般|行政|町長|議長|委員長|総括|提案|討論|採決|報告|発議|一般質問|再開|.*(宣告|議決|報告|互選|質疑|説明|審査|選挙|表決|決定))/

function toDate(m: RegExpExecArray): string {
  const eraYear = m[2] === "元" ? 1 : Number(toHalf(m[2]))
  const year = (m[1] === "令和" ? 2018 : 1988) + eraYear
  return `${year}-${toHalf(m[3]).padStart(2, "0")}-${toHalf(m[4]).padStart(2, "0")}`
}

export function parseSpeeches(layoutText: string): { speeches: Speech[]; anomalies: Anomaly[] } {
  const speeches: Speech[] = []
  const anomalies: Anomaly[] = []
  let agenda = ""
  let date = ""
  let current: Speech | null = null
  let state: "front" | "heading" | "speech" = "front"
  const close = (next: "front" | "heading" | "speech") => { current = null; state = next }

  layoutText.split("\f").forEach((pageText, i) => {
    const page = i + 1
    for (const rawLine of pageText.split("\n")) {
      const flat = rawLine.replace(/　/g, " ")
      const indent = flat.length - flat.trimStart().length
      const line = normalizeLine(rawLine)
      if (line === "" || PAGE_NUMBER.test(line)) continue

      const day = DAY_HEADER.exec(line)
      if (day && line.length < 40) { date = toDate(day); close("front"); continue }
      if (indent >= 2 && line.length < 50 && SESSION_TITLE.test(line)) { close("front"); continue }
      if (SIGNATURE.test(line)) { close("front"); continue }

      if (line.startsWith("◎")) {
        const parsed = indent < 2 ? parseSpeechLine(line) : null
        if (parsed) {
          if (!date) anomalies.push({ page, kind: "日付が未確定のまま発言", line: line.slice(0, 40) })
          current = { agenda, speaker: parsed.speaker, role: parsed.role, date, page, text: parsed.text }
          speeches.push(current)
          state = "speech"
        } else if (indent >= 2 || AGENDA_WORD.test(line)) {
          agenda = line.slice(1)
          close("heading")
        } else if (date) {
          // date が未確定の ◎ は予算特別委員会の目次（◎一般会計 など）なので数えない
          anomalies.push({ page, kind: "◎行を発言にも見出しにもできない", line: line.slice(0, 60) })
        }
        continue
      }

      if (state === "heading") {
        if (indent >= 2) agenda += line
        else state = "front"
        continue
      }
      if (state === "speech" && current) {
        if (STAGE.test(line)) continue
        const speech: Speech = current
        speech.text += indent >= 1 ? `\n${line}` : line
      }
    }
  })

  for (const s of speeches) {
    if (s.text.length > LONG_SPEECH_CHARS) {
      anomalies.push({ page: s.page, kind: `発言が長すぎる（${s.text.length}字）`, line: `${s.speaker}${s.role}: ${s.text.slice(0, 30)}` })
    }
  }
  return { speeches, anomalies }
}

// ── sessionKey ──────────────────────────────────────────────────────────────

interface Dates { start: string; end: string }

/** `R8.3.2～R8.3.18` / `R6.3.4~3.21` / `R7.12.19～R8.1.20` / `H31.3.4~3.22` */
export function parseTitleDates(title: string): Dates | null {
  const m = /([RH])(\d+)\.(\d+)\.(\d+)(?:\s*[~～〜]\s*(?:([RH])(\d+)\.)?(\d+)\.(\d+))?/.exec(title)
  if (!m) return null
  const year = (era: string, y: string) => (era === "R" ? 2018 : 1988) + Number(y)
  const fmt = (y: number, mo: string, d: string) => `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
  const startYear = year(m[1], m[2])
  const start = fmt(startYear, m[3], m[4])
  if (!m[7]) return { start, end: start }
  return { start, end: fmt(m[5] ? year(m[5], m[6]) : startYear, m[7], m[8]) }
}

const eraPrefix = (date: string) => {
  const y = Number(date.slice(0, 4))
  const beforeReiwa = date < "2019-05-01"
  return `${beforeReiwa ? `h${y - 1988}` : `r${y - 2018}`}-${y}`
}

/** 既存の命名に合わせる。R8以降の臨時会は2桁ゼロ埋め（session-id-rules.ts と同じ） */
export function sessionKeyOf(title: string, d: Dates, existing: string[]): string | null {
  const prefix = eraPrefix(d.start)
  const month = d.start.slice(5, 7)
  const number = /第(\d+)回/.exec(title)?.[1]

  if (title.includes("基本構想")) {
    return `${eraPrefix(d.end)}-${d.end.slice(5, 7)}-${d.end.slice(8, 10)}-basic-plan`
  }
  let slug: string | null = null
  if (title.includes("子ども議会") && number) slug = `kodomo-${number}`
  else if (title.includes("定例") && number) slug = `regular-${number}`
  else if (title.includes("臨時") && number) {
    slug = `rinji-${d.start >= "2026-01-01" ? number.padStart(2, "0") : number}`
  } else if (title.includes("予算特別")) slug = "yosan-tokubetsu"
  else if (title.includes("決算特別")) slug = "kessan-tokubetsu"
  if (!slug) return null

  const inferred = `${prefix}-${month}-${slug}`
  if (existing.includes(inferred)) return inferred
  // 実例: r8-2026-01-27-rinji-01（IDに日が入っている既存）
  const dated = existing.filter(id => id.startsWith(`${prefix}-${month}-`) && id.endsWith(`-${slug}`))
  return dated.length === 1 ? dated[0] : inferred
}

// ── メイン ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function layoutTextOf(entry: KaigirokuEntry, workDir: string, cacheDir: string | null): Promise<string> {
  const name = path.basename(new URL(entry.pdfUrl).pathname)
  const id = entry.pdfUrl.split("/").slice(-2, -1)[0]
  const pdf = path.join(cacheDir ?? workDir, `${id}-${name}`)
  if (!fs.existsSync(pdf)) {
    await sleep(FETCH_INTERVAL_MS)
    const res = await http.get<ArrayBuffer>(entry.pdfUrl, { responseType: "arraybuffer", timeout: 120_000 })
    fs.writeFileSync(pdf, Buffer.from(res.data))
  }
  const text = execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", pdf, "-"], { encoding: "utf-8", maxBuffer: 1 << 28 })
  if (!cacheDir) fs.rmSync(pdf)
  return text
}

async function main() {
  const argv = process.argv.slice(2)
  const all = argv.includes("--all")
  const cacheIdx = argv.indexOf("--cache")
  const cacheDir = cacheIdx >= 0 ? path.resolve(argv[cacheIdx + 1]) : null
  if (cacheDir?.startsWith(ROOT + path.sep)) throw new Error("--cache にリポジトリ内は指定できません（PDFを置かないため）")
  if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true })

  const index = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "index.json"), "utf-8")) as KaigirokuEntry[]
  const existing = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "kaigiroku-"))

  const map: Record<string, unknown>[] = []
  const report: Record<string, unknown>[] = []
  const unresolved: string[] = []
  const seen = new Set<string>()

  for (const entry of index) {
    // 平成22〜26年の特別委員会は索引の題名に日付が無いので、本文の日付で決める
    const titleDates = parseTitleDates(entry.title)
    if (titleDates && !all && titleDates.start < "2019-05-01") continue
    if (!titleDates && !all) continue

    const layout = await layoutTextOf(entry, workDir, cacheDir)
    const held0 = parseSpeeches(layout).speeches.map(s => s.date).filter(Boolean).sort()
    const dates = titleDates ?? (held0.length ? { start: held0[0], end: held0[held0.length - 1] } : null)
    if (!dates) { unresolved.push(`日付を読めない: ${entry.year} ${entry.title}`); continue }
    const key = sessionKeyOf(entry.title, dates, existing)
    if (!key) { unresolved.push(`sessionKeyを決められない: ${entry.year} ${entry.title}`); continue }
    if (seen.has(key)) { unresolved.push(`sessionKeyが重複: ${key} ${entry.title}`); continue }
    seen.add(key)

    const { speeches, anomalies } = parseSpeeches(layout)
    const raw = layout.split("\f").map(p => p.split("\n").map(normalizeLine).join("\n").replace(/\n{2,}/g, "\n").trim()).join("\f\n")
    const speechChars = speeches.reduce((n, s) => n + s.text.length, 0)

    const dir = path.join(OUT_DIR, key)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "raw.txt"), raw + "\n")
    fs.writeFileSync(path.join(dir, "speeches.json"), `[\n${speeches.map(s => JSON.stringify(s)).join(",\n")}\n]\n`)

    // 町の索引の日付は誤りがある（実例: 令和3年定例第1回）。開催日はPDFの本文を正とする
    const held = speeches.map(s => s.date).filter(Boolean).sort()
    map.push({
      sessionKey: key, title: entry.title, start: held[0] ?? dates.start, end: held[held.length - 1] ?? dates.end, pdfUrl: entry.pdfUrl,
      existingSession: existing.includes(key) ? key : null,
    })
    report.push({
      sessionKey: key, pages: layout.split("\f").length - 1, rawChars: raw.length,
      speeches: speeches.length, speechChars, anomalies,
    })
    console.log(`${key}: ${speeches.length} 発言 / ${raw.length.toLocaleString()} 字 / 異常 ${anomalies.length}`)
  }

  fs.rmSync(workDir, { recursive: true, force: true })
  fs.writeFileSync(path.join(DATA_DIR, "session-map.json"), JSON.stringify(map, null, 2) + "\n")
  fs.writeFileSync(path.join(DATA_DIR, "extract-report.json"), JSON.stringify({ unresolved, sessions: report }, null, 2) + "\n")
  console.log(`\n✅ ${map.length} 本。未解決 ${unresolved.length} 件`)
  unresolved.forEach(u => console.log(`  ${u}`))
}

if (path.basename(process.argv[1] ?? "") === "extract.ts") {
  main().catch((err) => {
    console.error("extract failed:", err)
    process.exit(1)
  })
}
