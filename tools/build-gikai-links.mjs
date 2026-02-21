// tools/build-gikai-links.mjs
// CSV (data/gikai_links.csv) → JSON (public/data/gikai_links.json)
//
// CSVフォーマット（v2: 4列）:
//   caseType,eraLabel,num,ref
//   例: 議案,令和7年,26,theme:finance

import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const INPUT  = join(ROOT, "data", "gikai_links.csv")
const OUTPUT = join(ROOT, "public", "data", "gikai_links.json")

// ── CSV parse ──────────────────────────────────────────────────────
// 空行・コメント行（# 始まり）を除きながら元ファイルの行番号を保持する

const raw = readFileSync(INPUT, "utf-8")

/** @type {{ lineNum: number; text: string }[]} */
const effective = raw
  .split("\n")
  .map((text, i) => ({ lineNum: i + 1, text: text.trim() }))
  .filter(({ text }) => text.length > 0 && !text.startsWith("#"))

if (effective.length === 0) {
  console.log("gikai_links.csv: no data rows – writing empty object")
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, "{}\n", "utf-8")
  process.exit(0)
}

const [headerEntry, ...dataEntries] = effective
const cols = headerEntry.text.split(",").map((c) => c.trim())

const COL_CASE_TYPE = cols.indexOf("caseType")
const COL_ERA_LABEL = cols.indexOf("eraLabel")
const COL_NUM       = cols.indexOf("num")
const COL_REF       = cols.indexOf("ref")

if (COL_CASE_TYPE === -1 || COL_ERA_LABEL === -1 || COL_NUM === -1 || COL_REF === -1) {
  console.error(`ERROR: line ${headerEntry.lineNum}: header must contain caseType, eraLabel, num, ref (4 columns)`)
  console.error(`  Found: ${headerEntry.text}`)
  console.error(`  旧フォーマット（3列）のCSVが混在していないか確認してください。`)
  process.exit(1)
}

// ── Validation ─────────────────────────────────────────────────────

const VALID_REF = /^(theme|issue):.+$/

function validateRow(fields, lineNum) {
  const errors = []

  const maxRequired = Math.max(COL_CASE_TYPE, COL_ERA_LABEL, COL_NUM, COL_REF)
  if (fields.length <= maxRequired) {
    console.error(`ERROR: line ${lineNum}: expected at least ${maxRequired + 1} columns, got ${fields.length}`)
    process.exit(1)
  }

  const caseType = (fields[COL_CASE_TYPE] ?? "").trim()
  const eraLabel = (fields[COL_ERA_LABEL] ?? "").trim()
  const numStr   = (fields[COL_NUM]       ?? "").trim()
  // ref 列はインラインコメントを除去する（"  # " 以降を捨てる）
  const ref      = (fields[COL_REF]       ?? "").replace(/\s*#.*$/, "").trim()

  if (!caseType)  errors.push("caseType is empty")
  if (!eraLabel)  errors.push("eraLabel is empty")

  const num = Number(numStr)
  if (!numStr || !Number.isInteger(num) || num <= 0) {
    errors.push(`num must be a positive integer, got: "${numStr}"`)
  }

  if (!VALID_REF.test(ref)) {
    errors.push(`ref must start with "theme:" or "issue:", got: "${ref}"`)
  }

  if (errors.length > 0) {
    console.error(`ERROR: line ${lineNum}: ${errors.join("; ")}`)
    process.exit(1)
  }

  return { caseType, eraLabel, num, ref }
}

// ── Build map ──────────────────────────────────────────────────────

/** @type {Map<string, Set<string>>} */
const map = new Map()

for (const { lineNum, text } of dataEntries) {
  const fields = text.split(",")
  const { caseType, eraLabel, num, ref } = validateRow(fields, lineNum)

  const key = `${eraLabel}-${caseType}-${num}`
  if (!map.has(key)) map.set(key, new Set())
  map.get(key).add(ref)
}

// ── Serialize ──────────────────────────────────────────────────────

const obj = Object.fromEntries(
  [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ja"))
    .map(([key, refSet]) => [key, [...refSet].sort()])
)

// ── Write ──────────────────────────────────────────────────────────

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(obj, null, 2) + "\n", "utf-8")

const keyCount = Object.keys(obj).length
const refCount = Object.values(obj).reduce((s, a) => s + a.length, 0)
console.log(`✓ gikai_links.json: ${keyCount} keys, ${refCount} refs → ${OUTPUT}`)
