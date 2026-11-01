// 広報しんとくの索引から駅前の語が出るページを抜き出し、PDFの文字の大きさで見出しを読む。API は呼ばない。
//
//   npm run kaigiroku:koho-pages -- ekimae --cache <リポジトリ外のdir>
//
//   content/traces/{theme}.koho-pages.json   号・ページ・見出し・語
//
// PDFは保存しない（--cache はリポジトリ外だけ）。本文の照合は public/data/newsletters_index.json に対して行う。

import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"
import { http } from "../lib/http"

const ROOT = process.cwd()
const KEYWORDS = /駅前|複合施設|地域交流センター|交流センター|とくとく|トクトク|温浴|町営浴場|ステラステーション|タウンマネ/
const FETCH_INTERVAL_MS = 1_000
const HEADING_RATIO = 1.45
const MIN_HEADING_CHARS = 4
const FURNITURE = /^(\d+|広報しんとく.*|.*No\.\d+.*|\d{4}\.\d+.*|特集)$/

interface Issue { title: string; date: string; url: string; pages: { page: number; text: string }[] }
interface Line { text: string; y: number; h: number }

const WIDE = "\\u3000-\\u30ff\\u3400-\\u9fff\\uff00-\\uffef"
const clean = (s: string) => s.replace(new RegExp(`([${WIDE}]) +(?=[${WIDE}])`, "g"), "$1").replace(/\s+/g, " ").trim()
  // 影付きの見出しは同じ語が2回入る（特集特集）
  .replace(/^(.{2,}?) ?\1$/, "$1")
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")

function linesOf(pdf: string, page: number): Line[] {
  const xml = execFileSync("pdftotext", ["-bbox-layout", "-f", String(page), "-l", String(page), pdf, "-"], { encoding: "utf-8", maxBuffer: 1 << 28 })
  return [...xml.matchAll(/<line xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">([\s\S]*?)<\/line>/g)].map((m) => {
    const words = [...m[3].matchAll(/<word [^>]*>([^<]*)<\/word>/g)].map(w => decode(w[1]))
    return { text: clean(words.join(" ")), y: Number(m[1]), h: Number(m[2]) - Number(m[1]) }
  }).filter(l => l.text)
}

/** キーワードの行より上で最も近い大きな文字の行。無ければページで最も大きな行 */
function headingOf(lines: Line[]): string | null {
  const sizes = lines.map(l => l.h).sort((a, b) => a - b)
  const median = sizes[sizes.length >> 1] ?? 0
  const big = lines.filter(l => l.h >= median * HEADING_RATIO && l.text.replace(/\s/g, "").length >= MIN_HEADING_CHARS && !FURNITURE.test(l.text))
  if (big.length === 0) return null
  const at = lines.find(l => KEYWORDS.test(l.text))?.y
  const above = at === undefined ? [] : big.filter(l => l.y <= at).sort((a, b) => b.y - a.y)
  return (above[0] ?? [...big].sort((a, b) => b.h - a.h)[0]).text
}

async function main() {
  const theme = process.argv[2]
  const cacheIdx = process.argv.indexOf("--cache")
  const cache = cacheIdx >= 0 ? path.resolve(process.argv[cacheIdx + 1]) : null
  if (!cache || cache.startsWith(ROOT + path.sep)) throw new Error("--cache にリポジトリ外のディレクトリを指定してください")
  fs.mkdirSync(cache, { recursive: true })

  const issues = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", "newsletters_index.json"), "utf-8")) as Issue[]
  const rows: Record<string, unknown>[] = []
  for (const issue of [...issues].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const hits = issue.pages.filter(p => KEYWORDS.test(p.text))
    if (hits.length === 0) continue
    const pdf = path.join(cache, `${issue.date}.pdf`)
    if (!fs.existsSync(pdf)) {
      await new Promise(r => setTimeout(r, FETCH_INTERVAL_MS))
      const res = await http.get<ArrayBuffer>(issue.url, { responseType: "arraybuffer", timeout: 300_000 })
      fs.writeFileSync(pdf, Buffer.from(res.data))
    }
    for (const p of hits) {
      const lines = linesOf(pdf, p.page)
      rows.push({
        date: issue.date, title: issue.title.replace(/^広報しんとく\s*/, "").replace(/[)）(（]?A4[)）]?|\)$/g, "").trim(), page: p.page,
        url: `${issue.url}#page=${p.page}`, heading: headingOf(lines),
        keywords: [...new Set(p.text.match(new RegExp(KEYWORDS.source, "g")) ?? [])],
      })
    }
    console.log(`${issue.date}: ${hits.length} ページ`)
  }
  const out = path.join(ROOT, "content", "traces", `${theme}.koho-pages.json`)
  fs.writeFileSync(out, `[\n${rows.map(r => JSON.stringify(r)).join(",\n")}\n]\n`)
  const table = rows.map(r => `| ${String(r.date).slice(0, 7)} | ${r.title} | [p.${r.page}](${r.url}) | ${String(r.heading ?? "（読めず）").replace(/\|/g, "／")} | ${(r.keywords as string[]).join("・")} |`)
  fs.writeFileSync(out.replace(/\.json$/, ".md"), [
    "# 広報しんとくの駅前に関するページ", "",
    "`npm run kaigiroku:koho-pages` の生成物。語が出るページの機械的な一覧で、会場の案内なども含む。見出しは文字の大きさからの推定で、本文の断片を拾っていることがある。", "",
    "| 発行月 | 号 | ページ | 見出し（推定） | 語 |", "|---|---|---|---|---|", ...table, "",
  ].join("\n"))
  console.log(`✅ ${rows.length} ページ → ${path.relative(ROOT, out)} / 見出しなし ${rows.filter(r => !r.heading).length}`)
}

main().catch((err) => {
  console.error("koho-pages failed:", err)
  process.exit(1)
})
