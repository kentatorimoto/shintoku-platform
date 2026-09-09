// 史跡MDの本文 → 公開用の概要（2〜3文）を Claude API で生成する。
//
//   npm run shiseki:summary -- --ids s01,s14,s26 [--force]
//   npm run shiseki:summary -- --limit 3         # 未作成のものを先頭から3件
//
// 設計:
//   - **公開できるのは概要レベルまで**（docs/content-schema.md §12.1）。本文はAPIに渡すが、
//     書き戻すのは frontmatter の `summary` だけ。本文には一切触れない。
//   - 生成後 `reviewed: false` のまま。人が読んで直し、true にして初めてUIの確定表示になる
//     （議会の要点カードと同じゲート）。
//   - 生成後 build-data のバリデータを走らせ、落ちたらエラーをそのまま返して直させる。

import fs from "fs"
import path from "path"
import Anthropic from "@anthropic-ai/sdk"
import yaml from "js-yaml"
import { buildFromContent, readFrontmatter } from "./build-data"
import { callClaude, logUsage, stripFences, type Message, type Usage } from "./extract-md"
import { EXIT, MAX_SELF_CORRECTION_ROUNDS } from "./config"

const ROOT        = process.cwd()
const CONTENT_DIR = path.join(ROOT, "content")
const SHISEKI_DIR = path.join(CONTENT_DIR, "archive", "shintoku-shiseki")
const PROMPT_PATH = path.join(ROOT, "scripts", "prompts", "shiseki-summary.md")

const dumpYaml = (v: unknown): string => yaml.dump(v, { lineWidth: -1, noRefs: true, quoteStyle: "double" })

// ── 対象の選定 ──────────────────────────────────────────────────────────────

interface Target {
  id:    string
  file:  string
  fm:    Record<string, unknown>
  body:  string
}

function readTarget(id: string): Target {
  const file = path.join(SHISEKI_DIR, `${id}.md`)
  if (!fs.existsSync(file)) throw new Error(`${path.relative(ROOT, file)} がありません`)
  const { data, body } = readFrontmatter(fs.readFileSync(file, "utf-8"))
  return { id, file, fm: data, body: body.trim() }
}

function listIds(): string[] {
  return fs.readdirSync(SHISEKI_DIR)
    .filter(f => /^s\d+\.md$/.test(f))
    .map(f => f.replace(/\.md$/, ""))
    .sort()
}

// ── プロンプト ──────────────────────────────────────────────────────────────

/** 本文は渡すが、書き戻すのは概要だけ。原文の言い回しをなぞらせないための指示は system 側にある。 */
function buildUserMessage(t: Target): string {
  const meta = [
    `- 史跡名: ${String(t.fm.title)}`,
    `- 原本ページ: p.${String(t.fm.page_start)}`,
    t.fm.location ? `- 所在地: ${String(t.fm.location)}` : null,
    t.fm.era ? `- 年代: ${String(t.fm.era)}` : null,
  ].filter(l => l !== null).join("\n")

  return `次の史跡について、公開用の概要を2〜3文で書いてください。\n\n## メタ\n\n${meta}\n\n## 本文（『しんとくの史跡』より。この言い回しをなぞらないこと）\n\n${t.body}`
}

// ── 書き戻し ────────────────────────────────────────────────────────────────

/** frontmatter の `summary` だけを差し替える。本文は原文のまま残す。 */
function writeSummary(t: Target, summary: string) {
  const fm = { ...t.fm, summary }
  fs.writeFileSync(t.file, `---\n${dumpYaml(fm)}---\n\n${t.body}\n`)
}

/** 書き込んだMDが build:data を通るか検証する。JSONは書かない。 */
function validate(): string | null {
  try {
    buildFromContent(CONTENT_DIR)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

// ── 生成本体 ────────────────────────────────────────────────────────────────

export interface SummaryResult {
  id:      string
  title:   string
  summary: string
  usage:   Usage
  rounds:  number
}

async function generateOne(client: Anthropic, system: string, id: string): Promise<SummaryResult> {
  const t = readTarget(id)
  const messages: Message[] = [{ role: "user", content: buildUserMessage(t) }]
  const total: Usage = { input: 0, output: 0, cacheRead: 0 }
  let lastError: string | null = null

  for (let round = 0; round <= MAX_SELF_CORRECTION_ROUNDS; round++) {
    const { content, text, usage } = await callClaude(client, system, messages)
    total.input += usage.input
    total.output += usage.output
    total.cacheRead += usage.cacheRead

    const summary = stripFences(text).replace(/\s*\n\s*/g, "").trim()
    writeSummary(t, summary)

    lastError = validate()
    if (lastError === null) {
      return { id, title: String(t.fm.title), summary, usage: total, rounds: round }
    }
    if (round === MAX_SELF_CORRECTION_ROUNDS) break

    messages.push({ role: "assistant", content })
    messages.push({
      role: "user",
      content: `書き込んだ概要が build:data のバリデーションで落ちました。概要だけを書き直してください。\n\n## エラー\n\n${lastError}`,
    })
  }

  throw new Error(
    `${MAX_SELF_CORRECTION_ROUNDS} 回の自己修正でもバリデーションを通りませんでした（${id}）。\n${lastError}`,
  )
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    ids:   get("--ids")?.split(",").map(s => s.trim()).filter(Boolean),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    force: argv.includes("--force"),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  let ids: string[]
  if (args.ids) {
    ids = args.ids
  } else {
    // 未作成（summary が無い）ものを掲載順に
    ids = listIds().filter(id => {
      const s = readTarget(id).fm.summary
      return typeof s !== "string" || s.trim() === ""
    })
    if (args.limit !== undefined) ids = ids.slice(0, args.limit)
  }
  if (ids.length === 0) throw new Error("対象がありません（--ids か --limit を指定してください）")

  // 既存の概要を壊さない。作り直すには --force
  if (!args.force) {
    const done = ids.filter(id => {
      const s = readTarget(id).fm.summary
      return typeof s === "string" && s.trim() !== ""
    })
    if (done.length > 0) {
      throw new Error(`${done.join(", ")} には既に概要があります。作り直すには --force を付けてください。`)
    }
  }

  const client = new Anthropic()
  const system = fs.readFileSync(PROMPT_PATH, "utf-8")
  console.log(`   対象 ${ids.length}件: ${ids.join(", ")}`)

  const results: SummaryResult[] = []
  const total: Usage = { input: 0, output: 0, cacheRead: 0 }
  for (const id of ids) {
    console.log(`\n   ${id} を生成中…`)
    const r = await generateOne(client, system, id)
    results.push(r)
    total.input += r.usage.input
    total.output += r.usage.output
    total.cacheRead += r.usage.cacheRead
    logUsage(id, r.usage)
    console.log(`   ${r.title}（${r.summary.length}字, 自己修正${r.rounds}回）`)
    console.log(`     ${r.summary}`)
  }

  logUsage("合計", total)
  console.log(`\n✅ ${results.length}件の概要を書き込みました（reviewed: false のまま）`)
  console.log(`   内容を確認したら reviewed: true に変えてコミットしてください。`)
}

if (path.basename(process.argv[1] ?? "") === "generate-shiseki-summary.ts") {
  main().catch((err) => {
    console.error(`❌ shiseki:summary failed:\n${err instanceof Error ? err.message : err}`)
    process.exit(EXIT.ERROR)
  })
}
