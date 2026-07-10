// 往復一致テスト: public/data/*.json → MD → JSON が構造一致することを検証する。
//
//   npx tsx scripts/roundtrip-test.ts
//
// 判定は「構造一致（deep equal）」。バイト一致ではない。
// 既存JSONは手動・NotebookLM経由で作られておりキー順や整形が揃っている保証がないため、
// 意味論の一致が証明できれば「MDが正典」への切替の安全性としては十分。
//
// public/data/ には一切書き込まない（MD生成は一時ディレクトリへ）。

import fs from "fs"
import os from "os"
import path from "path"
import { convertAll } from "./json-to-md"
import { buildFromContent } from "../build-data"
import type { GikaiSession, PartData } from "../lib/schema"

const ROOT          = process.cwd()
const SESSIONS_JSON = path.join(ROOT, "public", "data", "gikai_sessions.json")
const QNA_DIR       = path.join(ROOT, "public", "data", "qna")

// ── deep equal（不一致箇所をJSONパスで列挙する）─────────────────────────────

interface Mismatch {
  path:     string
  expected: string
  actual:   string
}

const show = (v: unknown): string => (v === undefined ? "(なし)" : JSON.stringify(v))

function diff(expected: unknown, actual: unknown, at: string, out: Mismatch[]): void {
  if (expected === actual) return

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      out.push({ path: at, expected: show(expected), actual: show(actual) })
      return
    }
    if (expected.length !== actual.length) {
      out.push({ path: `${at}.length`, expected: String(expected.length), actual: String(actual.length) })
    }
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
      diff(expected[i], actual[i], `${at}[${i}]`, out)
    }
    return
  }

  const bothObjects =
    expected !== null && actual !== null &&
    typeof expected === "object" && typeof actual === "object"

  if (bothObjects) {
    const e = expected as Record<string, unknown>
    const a = actual as Record<string, unknown>
    for (const key of new Set([...Object.keys(e), ...Object.keys(a)])) {
      diff(e[key], a[key], at === "" ? key : `${at}.${key}`, out)
    }
    return
  }

  out.push({ path: at, expected: show(expected), actual: show(actual) })
}

// ── 実行 ────────────────────────────────────────────────────────────────────

function readOriginals(): { sessions: GikaiSession[]; parts: Map<string, PartData> } {
  const sessions: GikaiSession[] = JSON.parse(fs.readFileSync(SESSIONS_JSON, "utf-8"))
  const parts = new Map<string, PartData>()
  for (const file of fs.readdirSync(QNA_DIR).filter(f => f.endsWith(".json")).sort()) {
    parts.set(file, JSON.parse(fs.readFileSync(path.join(QNA_DIR, file), "utf-8")))
  }
  return { sessions, parts }
}

/** セッション配列を id → 位置 で照合しやすい形にしつつ、順序そのものも検証対象にする。 */
function compareSessions(expected: GikaiSession[], actual: GikaiSession[]): Mismatch[] {
  const out: Mismatch[] = []

  const expectedIds = expected.map(s => s.id)
  const actualIds   = actual.map(s => s.id)
  if (expectedIds.join("|") !== actualIds.join("|")) {
    out.push({
      path:     "gikai_sessions.json[].id（並び順）",
      expected: expectedIds.join(" → "),
      actual:   actualIds.join(" → "),
    })
  }

  // 並び順の差分とは独立に、各セッションの中身を id で突き合わせる
  const actualById = new Map(actual.map(s => [s.id, s]))
  for (const session of expected) {
    const found = actualById.get(session.id)
    if (!found) {
      out.push({ path: `gikai_sessions.json[${session.id}]`, expected: "存在する", actual: "(なし)" })
      continue
    }
    diff(session, found, `gikai_sessions.json[${session.id}]`, out)
  }
  for (const session of actual) {
    if (!expected.some(s => s.id === session.id)) {
      out.push({ path: `gikai_sessions.json[${session.id}]`, expected: "(なし)", actual: "存在する" })
    }
  }

  return out
}

function comparePartFiles(expected: Map<string, PartData>, actual: Map<string, PartData>): Mismatch[] {
  const out: Mismatch[] = []
  for (const name of new Set([...expected.keys(), ...actual.keys()])) {
    const e = expected.get(name)
    const a = actual.get(name)
    if (!e) { out.push({ path: `qna/${name}`, expected: "(なし)", actual: "生成された" }); continue }
    if (!a) { out.push({ path: `qna/${name}`, expected: "生成されるはず", actual: "(なし)" }); continue }
    diff(e, a, `qna/${name}`, out)
  }
  return out
}

async function main() {
  const original = readOriginals()

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shintoku-roundtrip-"))
  try {
    const converted = convertAll(tmpDir)
    if (converted.warnings.length > 0) {
      console.warn(`⚠️  json-to-md が ${converted.warnings.length} 件の要確認箇所を報告しました:`)
      for (const w of converted.warnings) console.warn(`  ${w.file} ${w.path}: ${w.message}`)
    }

    const rebuilt = buildFromContent(tmpDir)

    const mismatches = [
      ...compareSessions(original.sessions, rebuilt.sessions),
      ...comparePartFiles(original.parts, rebuilt.parts),
    ]

    if (mismatches.length > 0) {
      console.error(`\n❌ roundtrip 不一致 ${mismatches.length} 件:\n`)
      for (const m of mismatches) {
        console.error(`  ${m.path}`)
        console.error(`    expected: ${m.expected}`)
        console.error(`    actual:   ${m.actual}`)
      }
      process.exit(1)
    }

    console.log(`✅ roundtrip OK: ${rebuilt.sessions.length} sessions, ${rebuilt.parts.size} part files`)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(`roundtrip-test failed:\n${err instanceof Error ? err.message : err}`)
  process.exit(1)
})
