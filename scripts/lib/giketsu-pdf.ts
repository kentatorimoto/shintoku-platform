import { execFileSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

// 議決結果PDFの表を、単語の座標から読む（poppler の pdftotext が必要）。
//
// PDFのテキストは列ごとに書かれていて、番号と件名の対応が文字列の順番に残らない。
// そこで番号のセルを行の錨にして、件名・日付・結果を座標で番号へ割り当てる。
// 平成22〜26年のPDFはフォント未埋め込みで pdf.js からは文字が取れないが、poppler なら読める。

export interface TableRow {
  label: string   // "議案" / "意見案" / "報告" / "認定" など
  num: number
  title: string
  date: string    // "6月2日"
  result: string  // PDFの表記から空白を除いたもの（"同意" など）
}

interface Word {
  text: string
  x: number
  y: number      // 上が小さい
  right: number
}

const LABEL_RE = /^([^\s第]{1,4})第(\d+)号/
const WRAPPED_LABEL_RE = /^([^\s第]{1,4})第(\d+)$/
const DATE_RE = /(\d{1,2})月(\d{1,2})日/
const SAME_LINE = 3
// 一番近い番号でもこれより遠い文字は、表の外（欄外の注記など）として捨てる
const MAX_ROW_DISTANCE = 30

/** 全角英数を半角にして空白を除く（括弧などの全角記号はPDFの表記のまま） */
function normalize(str: string): string {
  return str
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
}

function decodeEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

/** 単語を上から順に行へまとめる */
function groupLines(words: Word[]): Word[][] {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: Word[][] = []
  for (const word of sorted) {
    const line = lines[lines.length - 1]
    if (line && word.y - line[0].y <= SAME_LINE) line.push(word)
    else lines.push([word])
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x)
  return lines
}

/** 行の中で、連結すると keyword になる単語列の始まりの x を返す */
function findColumnX(line: Word[], keyword: string): number | null {
  for (let i = 0; i < line.length; i++) {
    let text = ""
    for (let j = i; j < line.length && text.length < keyword.length; j++) {
      text += normalize(line[j].text)
    }
    if (text.startsWith(keyword)) return line[i].x
  }
  return null
}

/**
 * 件名の行を、順序を保ったまま番号へ分ける。
 * 番号はセルの縦中央に置かれるので、各ブロックの中心と番号の高さの差が最小になる分け方を選ぶ。
 * （一番近い番号へ割り当てると、5行の件名の端が隣の行に吸われる）
 */
function partitionLines(lineYs: number[], rowYs: number[]): number[] {
  const EMPTY_PENALTY = 10_000
  const n = lineYs.length
  const m = rowYs.length
  const cost = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(Infinity))
  const from = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  cost[0][0] = 0
  for (let r = 1; r <= m; r++) {
    for (let end = 0; end <= n; end++) {
      for (let start = 0; start <= end; start++) {
        const block =
          start === end
            ? EMPTY_PENALTY
            : ((lineYs[start] + lineYs[end - 1]) / 2 - rowYs[r - 1]) ** 2
        if (cost[r - 1][start] + block < cost[r][end]) {
          cost[r][end] = cost[r - 1][start] + block
          from[r][end] = start
        }
      }
    }
  }
  const starts = new Array<number>(m + 1).fill(n)
  for (let r = m; r >= 1; r--) starts[r - 1] = from[r][starts[r]]
  return starts
}

function readPageRows(words: Word[]): TableRow[] {
  const lines = groupLines(words)
  const headers = lines.filter((l) => findColumnX(l, "議案番号") !== null)
  if (headers.length === 0) return []

  const dateX = findColumnX(headers[0], "議決月日")
  const resultX = findColumnX(headers[0], "議決結果")
  const labelRight = headers[0].find((w) => normalize(w.text).startsWith("議案"))?.right
  if (dateX === null || resultX === null || labelRight === undefined) return []
  const margin = 15

  const rows: Array<{
    y: number
    label: string
    num: number
    title: Word[]
    date: Word[]
    result: Word[]
  }> = []
  const body: Word[][] = []
  let prefixY: number | null = null

  for (const line of lines) {
    if (line[0].y <= headers[0][0].y || headers.includes(line)) continue

    // 番号は番号列にある。件名の列に書かれた「議案第3号…」は番号として読まない
    let prefix = ""
    let consumed = 0
    let match: RegExpMatchArray | null = null
    if (line[0].x < labelRight) {
      for (const word of line) {
        prefix += normalize(word.text)
        consumed++
        match = prefix.match(LABEL_RE)
        if (match) break
      }
    }

    // 「意見案第10／号」のように、番号のセルの中で「号」だけ次の行へ折り返すことがある
    if (!match) {
      const labelText = line.filter((w) => w.x < labelRight).map((w) => normalize(w.text)).join("")
      match = labelText.match(WRAPPED_LABEL_RE)
      if (match) {
        prefix = labelText
        consumed = line.filter((w) => w.x < labelRight).length
      }
    }

    if (!match) {
      // 番号列の別の行は「（令和7年）／議案第90号」のような前年度の注記。件名には入れない
      if (line[0].x < labelRight && line.some((w) => w.x < labelRight && w.text.includes("年"))) {
        prefixY = line[0].y
      }
      const rest = line.filter((w) => w.x >= labelRight)
      if (rest.length > 0) body.push(rest)
      continue
    }
    rows.push({
      // 注記つきのセルでは、注記と番号の中間がセルの中央になる
      y: prefixY === null ? line[0].y : (prefixY + line[0].y) / 2,
      label: match[1],
      num: parseInt(match[2], 10),
      title: [],
      date: [],
      result: [],
    })
    prefixY = null
    const rest = line.slice(consumed)
    // 番号と件名が1単語に連結されている場合は、残りを件名として戻す
    const tail = prefix.slice(match[0].length)
    if (tail) rest.unshift({ ...line[consumed - 1], text: tail })
    if (rest.length > 0) body.push(rest)
  }
  if (rows.length === 0) return []

  const nearest = (y: number) =>
    rows.reduce((best, r) => (Math.abs(r.y - y) < Math.abs(best.y - y) ? r : best))

  const titleLines: Word[][] = []
  for (const line of body) {
    if (Math.abs(nearest(line[0].y).y - line[0].y) > MAX_ROW_DISTANCE) continue
    const titleWords = line.filter((w) => w.x < dateX - margin)
    if (titleWords.length > 0) titleLines.push(titleWords)
    // 日付と結果は番号と同じ高さに置かれる
    for (const word of line) {
      if (word.x >= resultX - margin) nearest(word.y).result.push(word)
      else if (word.x >= dateX - margin) nearest(word.y).date.push(word)
    }
  }

  const starts = partitionLines(titleLines.map((l) => l[0].y), rows.map((r) => r.y))
  rows.forEach((row, i) => {
    row.title = titleLines.slice(starts[i], starts[i + 1]).flat()
  })

  return rows.map((r) => {
    const date = normalize(r.date.map((w) => w.text).join("")).match(DATE_RE)
    return {
      label: r.label,
      num: r.num,
      title: r.title.map((w) => normalize(w.text)).join(""),
      date: date ? `${date[1]}月${date[2]}日` : "",
      result: normalize(r.result.map((w) => w.text).join("")),
    }
  })
}

/** pdftotext -bbox の出力から、全ページの表の行を読む */
export function parseBboxHtml(html: string): TableRow[] {
  const rows: TableRow[] = []
  for (const page of html.split(/<page\b/).slice(1)) {
    const words: Word[] = []
    for (const m of page.matchAll(
      /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)<\/word>/g
    )) {
      words.push({
        x: parseFloat(m[1]),
        y: parseFloat(m[2]),
        right: parseFloat(m[3]),
        text: decodeEntities(m[4]),
      })
    }
    rows.push(...readPageRows(words))
  }
  return rows
}

/** PDFのバイト列から、表の行と -layout のテキストを取り出す */
export function readGiketsuPdf(buf: Uint8Array): { rows: TableRow[]; layoutText: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "giketsu-"))
  try {
    const pdfPath = path.join(dir, "in.pdf")
    fs.writeFileSync(pdfPath, buf)
    const run = (flag: string) =>
      execFileSync("pdftotext", [flag, pdfPath, "-"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],  // 空白ページの "no word list" を出さない
        maxBuffer: 64 * 1024 * 1024,
      })
    return { rows: parseBboxHtml(run("-bbox")), layoutText: run("-layout") }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
