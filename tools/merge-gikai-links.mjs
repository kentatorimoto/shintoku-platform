// tools/merge-gikai-links.mjs
// data/gikai_links_suggested.csv を読み込み、
// data/gikai_links.csv に重複を避けて追記する。
//
// CSVフォーマット（v2: 4列）: caseType,eraLabel,num,ref
//
// 使い方:
//   npm run merge:links
//   → 追記後 npm run build:links で public/data/gikai_links.json を再生成

import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const SUGGESTED_CSV = join(ROOT, "data", "gikai_links_suggested.csv")
const MASTER_CSV    = join(ROOT, "data", "gikai_links.csv")

const VALID_REF = /^(theme|issue):.+$/

// ── ヘルパー ────────────────────────────────────────────────────────

/**
 * CSV テキストを有効行（空行・コメント行除去）の配列に分解し、
 * ヘッダー行から 4列インデックスを解決して返す。
 * @param {string} text
 * @param {string} label  エラーメッセージ用ファイル名
 * @returns {{ rows: string[][], colIdx: { ct: number, e: number, n: number, r: number } | null }}
 */
function parseCSV(text, label) {
  const lines = text
    .split("\n")
    .map((l, i) => ({ raw: l, lineNum: i + 1 }))
    .filter(({ raw }) => {
      const t = raw.trim()
      return t.length > 0 && !t.startsWith("#")
    })

  if (lines.length === 0) {
    return { rows: [], colIdx: null }
  }

  const header = lines[0].raw.split(",").map((c) => c.trim())
  const ct = header.indexOf("caseType")
  const e  = header.indexOf("eraLabel")
  const n  = header.indexOf("num")
  const r  = header.indexOf("ref")

  if (ct === -1 || e === -1 || n === -1 || r === -1) {
    console.error(`ERROR: ${label} のヘッダーが不正です（caseType,eraLabel,num,ref の4列が必要）`)
    console.error(`  Found: ${lines[0].raw.trim()}`)
    process.exit(1)
  }

  const maxIdx = Math.max(ct, e, n, r)
  const rows = lines.slice(1).map(({ raw, lineNum }) => {
    const fields = raw.split(",")
    if (fields.length <= maxIdx) {
      console.error(`ERROR: ${label} line ${lineNum}: 列数が不足しています（${maxIdx + 1}列必要）`)
      process.exit(1)
    }
    return fields
  })

  return { rows, colIdx: { ct, e, n, r } }
}

/**
 * フィールド配列から (caseType, eraLabel, num, ref) を抽出してバリデーションする。
 * ref はインラインコメントを除去してから検証。
 * エラー時は null を返す（呼び出し側でスキップ判断）。
 */
function extractFields(fields, colIdx, lineNum, label) {
  const { ct, e, n, r } = colIdx

  const caseType = (fields[ct] ?? "").trim()
  const eraLabel = (fields[e]  ?? "").trim()
  const numStr   = (fields[n]  ?? "").trim()
  const ref      = (fields[r]  ?? "").replace(/\s*#.*$/, "").trim()

  const errors = []
  if (!caseType) errors.push("caseType が空")
  if (!eraLabel) errors.push("eraLabel が空")

  const num = Number(numStr)
  if (!numStr || !Number.isInteger(num) || num <= 0) {
    errors.push(`num が正の整数でない: "${numStr}"`)
  }

  if (!VALID_REF.test(ref)) {
    errors.push(`ref が "theme:" または "issue:" で始まらない: "${ref}"`)
  }

  if (errors.length > 0) {
    console.error(`WARN: ${label} line ${lineNum}: ${errors.join("; ")} → スキップ`)
    return null
  }

  return { caseType, eraLabel, num, ref }
}

// ── マスター読み込み（重複チェック用） ─────────────────────────────

if (!existsSync(MASTER_CSV)) {
  console.error(`ERROR: ${MASTER_CSV} が見つかりません`)
  process.exit(1)
}

const masterText = readFileSync(MASTER_CSV, "utf-8")
const { rows: masterRows, colIdx: masterIdx } = parseCSV(masterText, "gikai_links.csv")

/** @type {Set<string>} "eraLabel|caseType|num|ref" */
const existing = new Set()

if (masterIdx) {
  for (let i = 0; i < masterRows.length; i++) {
    const parsed = extractFields(masterRows[i], masterIdx, i + 2, "gikai_links.csv")
    if (parsed) existing.add(`${parsed.eraLabel}|${parsed.caseType}|${parsed.num}|${parsed.ref}`)
  }
}

// ── 提案ファイル読み込み ────────────────────────────────────────────

if (!existsSync(SUGGESTED_CSV)) {
  console.error(`ERROR: ${SUGGESTED_CSV} が見つかりません`)
  console.error("  先に npm run suggest:links を実行してください")
  process.exit(1)
}

const suggestedText = readFileSync(SUGGESTED_CSV, "utf-8")
const { rows: sugRows, colIdx: sugIdx } = parseCSV(suggestedText, "gikai_links_suggested.csv")

// ── マージ ─────────────────────────────────────────────────────────

/** @type {{ caseType: string, eraLabel: string, num: number, ref: string }[]} */
const toAppend = []
let skipped     = 0
let invalid     = 0

for (let i = 0; i < sugRows.length; i++) {
  const parsed = extractFields(sugRows[i], sugIdx, i + 2, "gikai_links_suggested.csv")
  if (!parsed) {
    invalid++
    continue
  }

  const key = `${parsed.eraLabel}|${parsed.caseType}|${parsed.num}|${parsed.ref}`
  if (existing.has(key)) {
    skipped++
    continue
  }

  existing.add(key)  // 提案ファイル内での重複も防ぐ
  toAppend.push(parsed)
}

// ── 追記 ───────────────────────────────────────────────────────────

if (toAppend.length > 0) {
  // eraLabel 昇順 → num 昇順 → ref 昇順で並べて追記
  toAppend.sort((a, b) =>
    a.eraLabel.localeCompare(b.eraLabel, "ja") || a.num - b.num || a.ref.localeCompare(b.ref)
  )

  const appendLines = toAppend
    .map(({ caseType, eraLabel, num, ref }) => `${caseType},${eraLabel},${num},${ref}`)
    .join("\n")

  // マスターの末尾が改行で終わっているか確認してから追記
  const needsNewline = !masterText.endsWith("\n")
  writeFileSync(
    MASTER_CSV,
    masterText + (needsNewline ? "\n" : "") + appendLines + "\n",
    "utf-8"
  )
}

// ── サマリー ───────────────────────────────────────────────────────

console.log(`✓ ${MASTER_CSV}`)
console.log(`  追記: ${toAppend.length}件`)
console.log(`  スキップ(重複): ${skipped}件`)
if (invalid > 0) console.log(`  スキップ(不正行): ${invalid}件`)
console.log("")
if (toAppend.length > 0) {
  console.log("次のステップ: npm run build:links")
} else {
  console.log("追記なし。suggested.csv に新しい提案があるか確認してください。")
}
