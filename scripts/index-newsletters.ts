// 未取得の号のPDFを一時取得して全文を corpus の koho/{key}/raw.txt に保存し、横断検索の索引を年ごとに作る。
//
//   npm run index:newsletters [-- --cache <リポジトリ外のdir>]
//
//   {corpus}/koho/{key}/raw.txt    全文（非公開の shintoku-corpus。ページ境界は \f）。町民の名前が並ぶページは目印に置き換える
//   public/data/koho/years.json    索引のある年と大きさ
//   data/koho/personal-pages.json     目印に置き換えたページ（町民の名前が並ぶ欄）
//   data/koho/personal-suspects.json  取りこぼしの疑いがあるページ（本文に残す）
//   data/koho/minor-name-pages.json   索引から学校・学年と名前の文を外したページと文の数
//
// 索引では、学校・学年と児童生徒の名前が並ぶ文を外す（全文には残す）。
//
// 新しい号に疑いのページがあれば Telegram に号とページを知らせる。
//   public/data/koho/index-YYYY.json  その年の検索索引
//
// PDFは保存しない。pdftotext（poppler）が要る。

import { execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import { http } from "./lib/http"
import { corpusPath } from "./lib/corpus"
import type { KohoIssue } from "./lib/koho-issue"
import { maskedReason, personalMarker, personalReason, stripMinorNames, suspectReason } from "./lib/koho-personal"
import { notify } from "./lib/telegram"

const ROOT = process.cwd()
const INDEX_PATH = path.join(ROOT, "data", "koho", "index.json")
const CONTENT_DIR = corpusPath("koho")
const PUBLIC_DIR = path.join(ROOT, "public", "data", "koho")
const FETCH_INTERVAL_MS = 1_000
/** これ未満の文字数のページは「文字なし」と数える */
const BLANK_PAGE_CHARS = 30
/** 文字のあるページがこの割合に満たない号は、画像だけの号として取り込まない */
const MIN_TEXT_PAGE_RATIO = 0.5

/** 全角文字のあいだの空白を潰す（PDF抽出が1文字ずつ空けてくる見出し対策）。 */
const CJK = "\\u3040-\\u30ff\\u3400-\\u9fff\\uff66-\\uff9f"
const CJK_GAP = new RegExp(`([${CJK}]) +(?=[${CJK}])`, "g")

/**
 * PDFの抽出結果は、見出しなどで1文字ずつ空白が入る（「元 気 な ま ち」）。
 * そのままでは「元気なまち」で検索しても当たらないので、全角文字どうしの空白だけ潰す。
 * 英数字のあいだの空白（"September.2026 since.1950"）は語の区切りなので残す。
 */
export function normalizeText(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim()
  let prev = ""
  while (prev !== text) {
    prev = text
    text = text.replace(CJK_GAP, "$1")
  }
  return text
}

const cjkCount = (s: string) => (s.match(new RegExp(`[${CJK}]`, "g")) ?? []).length

async function extract(issue: KohoIssue, workDir: string, cacheDir: string | null): Promise<string[]> {
  const pdf = path.join(cacheDir ?? workDir, `${issue.key}.pdf`)
  if (!fs.existsSync(pdf)) {
    await new Promise(resolve => setTimeout(resolve, FETCH_INTERVAL_MS))
    const res = await http.get<ArrayBuffer>(issue.url, { responseType: "arraybuffer", timeout: 300_000 })
    fs.writeFileSync(pdf, Buffer.from(res.data))
  }
  const text = execFileSync("pdftotext", ["-enc", "UTF-8", pdf, "-"], { encoding: "utf-8", maxBuffer: 1 << 29 })
  if (!cacheDir) fs.rmSync(pdf)
  const pages = text.split("\f")
  if (pages[pages.length - 1].trim() === "") pages.pop()
  return pages
}

const joinPages = (pages: string[]) => pages.map(p => p.trim()).join("\f\n") + "\n"

/** 号の全文を読み、名前が並ぶページを目印に置き換えて保存する。何度流しても同じ結果になる */
function maskIssue(issue: KohoIssue): { page: number; text: string; personal: string | null }[] {
  const file = path.join(CONTENT_DIR, issue.key, "raw.txt")
  const pages = fs.readFileSync(file, "utf-8").split("\f")
  const out = pages.map((p, i) => {
    const already = maskedReason(p)
    const personal = already ?? personalReason(p)
    return { page: i + 1, text: personal ? personalMarker(personal) : p, personal }
  })
  const joined = joinPages(out.map(p => p.text))
  if (joined !== joinPages(pages)) {
    fs.writeFileSync(file, joined)
    issue.chars = joined.length - 1
  }
  return out
}

function writeSearchIndex(issues: KohoIssue[]) {
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true })
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })
  const years = [...new Set(issues.filter(i => i.status === "text").map(i => i.year))].sort((a, b) => b - a)
  const sizes: { year: number; bytes: number }[] = []
  const excluded: Record<string, unknown>[] = []
  const suspects: { key: string; page: number; url: string; reason: string }[] = []
  const minors: { key: string; page: number; url: string; sentences: number }[] = []
  for (const year of years) {
    const entries = issues.filter(i => i.status === "text" && i.year === year).map((issue) => ({
      title: issue.title.replace(/[（(]?A4版?[）)]?/, "").trim(), date: issue.date, url: issue.url,
      pages: maskIssue(issue).flatMap(({ page, text: raw, personal }) => {
        const where = { key: issue.key, page, url: `${issue.url}#page=${page}` }
        if (personal) {
          excluded.push({ ...where, reason: personal })
          return []
        }
        const { text, removed } = stripMinorNames(normalizeText(raw))
        if (removed > 0) minors.push({ ...where, sentences: removed })
        if (!text) return []
        const suspect = suspectReason(raw)
        if (suspect) suspects.push({ ...where, reason: suspect })
        return [{ page, text }]
      }),
    }))
    const body = JSON.stringify(entries)
    fs.writeFileSync(path.join(PUBLIC_DIR, `index-${year}.json`), body + "\n")
    sizes.push({ year, bytes: Buffer.byteLength(body) })
  }
  fs.writeFileSync(path.join(PUBLIC_DIR, "years.json"), JSON.stringify(sizes) + "\n")
  const writeRows = (file: string, rows: unknown[]) =>
    fs.writeFileSync(path.join(path.dirname(INDEX_PATH), file), `[\n${rows.map(r => JSON.stringify(r)).join(",\n")}\n]\n`)
  writeRows("personal-pages.json", excluded)
  writeRows("personal-suspects.json", suspects)
  writeRows("minor-name-pages.json", minors)
  console.log(`目印に置き換えたページ ${excluded.length} / 疑いのあるページ ${suspects.length}`)
  console.log(`索引から外した学校・学年と名前の文 ${minors.reduce((n, m) => n + m.sentences, 0)}（${minors.length} ページ）`)
  const total = sizes.reduce((n, s) => n + s.bytes, 0)
  const max = sizes.reduce((a, b) => (a.bytes > b.bytes ? a : b), { year: 0, bytes: 0 })
  console.log(`検索索引: ${years.length} 年分 / 合計 ${(total / 1e6).toFixed(1)}MB / 最大 ${max.year} 年 ${(max.bytes / 1e6).toFixed(2)}MB`)
  return suspects
}

async function main() {
  const cacheIdx = process.argv.indexOf("--cache")
  const cacheDir = cacheIdx >= 0 ? path.resolve(process.argv[cacheIdx + 1]) : null
  if (cacheDir?.startsWith(ROOT + path.sep)) throw new Error("--cache にリポジトリ内は指定できません（PDFを置かないため）")
  if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true })

  const issues = JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8")) as KohoIssue[]
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "koho-"))
  const failed: string[] = []
  const save = () => fs.writeFileSync(INDEX_PATH, `[\n${issues.map(i => JSON.stringify(i)).join(",\n")}\n]\n`)

  const newKeys = new Set<string>()
  for (const issue of issues) {
    if (issue.status !== "pending") continue
    try {
      const pages = await extract(issue, workDir, cacheDir)
      const blankPages = pages.flatMap((p, i) => (cjkCount(p) < BLANK_PAGE_CHARS ? [i + 1] : []))
      issue.pages = pages.length
      issue.blankPages = blankPages
      if ((pages.length - blankPages.length) / Math.max(pages.length, 1) < MIN_TEXT_PAGE_RATIO) {
        issue.status = "no-text"
        issue.chars = 0
        console.log(`${issue.key}: 文字なし（${pages.length} ページ中 ${blankPages.length} ページが空）`)
      } else {
        const raw = pages.map(p => p.split("\n").map(l => l.replace(CJK_GAP, "$1").trimEnd()).join("\n").replace(/\n{2,}/g, "\n").trim()).join("\f\n")
        const dir = path.join(CONTENT_DIR, issue.key)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, "raw.txt"), raw + "\n")
        issue.status = "text"
        issue.chars = raw.length
        newKeys.add(issue.key)
        console.log(`${issue.key}: ${pages.length} ページ / ${raw.length.toLocaleString()} 字`)
      }
      save()
    } catch (err) {
      failed.push(issue.key)
      console.error(`${issue.key}: 失敗 ${err instanceof Error ? err.message : err}`)
    }
  }

  fs.rmSync(workDir, { recursive: true, force: true })
  const suspects = writeSearchIndex(issues)
  save()
  const fresh = suspects.filter(q => newKeys.has(q.key))
  if (fresh.length > 0) {
    // 本文は載せない。号とページだけ知らせて、人がPDFで確かめる
    await notify("koho", `新しい号に ${fresh.length} ページ`, fresh.map(q => `${q.key} p.${q.page}（${q.reason}）\n${q.url}`))
  }
  if (failed.length > 0) {
    console.error(`❌ 取得に失敗した号: ${failed.join(", ")}`)
    process.exit(1)
  }
}

if (path.basename(process.argv[1] ?? "") === "index-newsletters.ts") {
  main().catch((err) => {
    console.error("Index failed:", err)
    process.exit(1)
  })
}
