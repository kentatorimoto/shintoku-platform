// 字幕（Layer 0）→ MD（正典）を Claude API で抽出する。
//
//   npx tsx scripts/extract-md.ts --session <id> --part day1 --type honkaigi|qna \
//     [--source-url <url>] [--date YYYY-MM-DD] [--force]
//
// 設計:
//   - frontmatter は本スクリプトが決定的に生成し、AIには本文だけを書かせる。
//     日付・part_index・_passthrough を AI に触らせない方が事故が減る。
//   - プロンプトは scripts/prompts/*.md に置き、docs/content-schema.md の該当節を
//     実行時に読み込んで埋め込む（スキーマとプロンプトの乖離を構造的に防ぐ）。
//   - 出力MDを書き込んでから build-data のバリデータを走らせ、失敗したら
//     エラーメッセージをそのまま Claude に返して直させる（最大 MAX_SELF_CORRECTION_ROUNDS 回）。

import fs from "fs"
import path from "path"
import Anthropic from "@anthropic-ai/sdk"
import yaml from "js-yaml"
import { buildFromContent } from "./build-data"
import { EFFORT, EXIT, MAX_SELF_CORRECTION_ROUNDS, MAX_TOKENS, MODEL, PRICING } from "./config"
import type { GikaiSession } from "./lib/schema"

const ROOT        = process.cwd()
const CONTENT_DIR = path.join(ROOT, "content")
const SCHEMA_DOC  = path.join(ROOT, "docs", "content-schema.md")
const PROMPT_DIR  = path.join(ROOT, "scripts", "prompts")

/** 字幕がこれを超えたら分割が必要。実データの最長は約32,000字（115分）。 */
const MAX_TRANSCRIPT_CHARS = 150_000

export type PartType = "qna" | "honkaigi"

// ── プロンプトの組み立て ────────────────────────────────────────────────────

/** `docs/content-schema.md` から `## {n}.` 節を丸ごと切り出す（`### n.1` 等も含む）。 */
function extractSchemaSections(doc: string, sections: number[]): string {
  const lines = doc.split("\n")
  const out: string[] = []

  let capturing = false
  for (const line of lines) {
    const heading = /^## (\d+)\./.exec(line)
    if (heading) capturing = sections.includes(Number(heading[1]))
    if (capturing) out.push(line)
  }

  const missing = sections.filter(n => !new RegExp(`^## ${n}\\.`, "m").test(doc))
  if (missing.length > 0) {
    throw new Error(`docs/content-schema.md に §${missing.join(", §")} が見つかりません`)
  }
  return out.join("\n").trim()
}

function buildSystemPrompt(partType: PartType): string {
  const template = fs.readFileSync(path.join(PROMPT_DIR, `extract-${partType}.md`), "utf-8")
  const glossary = fs.readFileSync(path.join(PROMPT_DIR, "glossary.md"), "utf-8")
  const schemaDoc = fs.readFileSync(SCHEMA_DOC, "utf-8")

  // §3 は共通frontmatter、§4 は qna 本文、§5 は honkaigi 本文
  const schema = extractSchemaSections(schemaDoc, partType === "qna" ? [3, 4] : [3, 5])

  return template
    .replace("{{SCHEMA}}", schema)
    .replace("{{GLOSSARY}}", glossary)
}

// ── frontmatter ─────────────────────────────────────────────────────────────

export interface Meta {
  sessionId:   string
  /** `day1` / `part2` / `session` — スキーマ §1 の命名規則 */
  partFile:    string
  partIndex:   number
  partType:    PartType
  sessionDate: string
  sourceUrl:   string
}

/** `day1` → 0 / `part3` → 2 / `session` → 0 */
export function partIndexOf(partFile: string): number {
  const m = /^(?:day|part)(\d+)$/.exec(partFile)
  if (m) return Number(m[1]) - 1
  if (partFile === "session") return 0
  throw new Error(`--part は day{n} / part{n} / session のいずれかです: "${partFile}"`)
}

function buildFrontmatter(meta: Meta): string {
  const today = new Date().toISOString().slice(0, 10)
  return [
    "---",
    `session_id: ${meta.sessionId}`,
    `part_index: ${meta.partIndex}`,
    `part_type: ${meta.partType}`,
    `session_date: "${meta.sessionDate}"`,
    `source_url: ${meta.sourceUrl}`,
    `extracted_by: ${MODEL}`,
    `extracted_at: "${today}"`,
    "reviewed: false",
    "---",
    "",
  ].join("\n")
}

// ── Claude API ──────────────────────────────────────────────────────────────

interface Usage {
  input:     number
  output:    number
  cacheRead: number
}

/** AIが指示に反してコードフェンスで包んだ場合に備えて剥がす。 */
function stripFences(text: string): string {
  const trimmed = text.trim()
  const fenced = /^```(?:markdown|md)?\n([\s\S]*)\n```$/.exec(trimmed)
  return (fenced ? fenced[1] : trimmed).trim()
}

function logUsage(label: string, usage: Usage) {
  const price = PRICING[MODEL]
  // キャッシュ読み出しは入力の約1割の単価
  const cost = price
    ? (usage.input / 1e6) * price.input +
      (usage.cacheRead / 1e6) * price.input * 0.1 +
      (usage.output / 1e6) * price.output
    : null
  const costText = cost === null ? "（単価未登録）" : `約 $${cost.toFixed(3)}`
  const cacheText = usage.cacheRead > 0 ? ` / キャッシュ読み ${usage.cacheRead.toLocaleString()}` : ""
  console.log(
    `   ${label}: 入力 ${usage.input.toLocaleString()}${cacheText} / ` +
    `出力 ${usage.output.toLocaleString()} トークン, ${costText}`,
  )
}

type Message = Anthropic.MessageParam

async function callClaude(
  client: Anthropic,
  system: string,
  messages: Message[],
): Promise<{ content: Anthropic.ContentBlock[]; text: string; usage: Usage }> {
  // 字幕は長いのでストリーミングする（非ストリーミングだとHTTPタイムアウトに当たる）。
  // system（スキーマ+glossary）は毎回同じなのでキャッシュする。自己修正ラウンドで効く。
  const stream = client.messages.stream({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    thinking:   { type: "adaptive" },
    output_config: { effort: EFFORT },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
  })
  const message = await stream.finalMessage()

  if (message.stop_reason === "max_tokens") {
    throw new Error(
      `出力が max_tokens (${MAX_TOKENS}) に達して途中で切れました` +
      `（実際の出力 ${message.usage.output_tokens.toLocaleString()} トークン）。\n` +
      `  adaptive thinking の思考トークンもこの枠を消費します。` +
      `config.ts の MAX_TOKENS を上げるか EFFORT を下げてください。`,
    )
  }
  if (message.stop_reason === "refusal") {
    throw new Error("Claude が応答を拒否しました。字幕の内容を確認してください。")
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("")

  return {
    content: message.content,
    text,
    usage: {
      input:     message.usage.input_tokens,
      output:    message.usage.output_tokens,
      cacheRead: message.usage.cache_read_input_tokens ?? 0,
    },
  }
}

// ── バリデーション ──────────────────────────────────────────────────────────

/**
 * 書き込んだMDが build:data を通るか検証する。JSONは書かない。
 * 失敗時のメッセージは「ファイルパス:行番号 + 期待と実際」を含むので、そのままAIに返せる。
 */
function validate(): string | null {
  try {
    buildFromContent(CONTENT_DIR)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

// ── 抽出本体 ────────────────────────────────────────────────────────────────

export interface ExtractResult {
  mdPath:      string
  rounds:      number
  usage:       Usage
  needsReview: string[]
}

export async function extractPart(meta: Meta, force = false): Promise<ExtractResult> {
  const sessionDir     = path.join(CONTENT_DIR, "sessions", meta.sessionId)
  const mdPath         = path.join(sessionDir, `${meta.partFile}.md`)
  const transcriptPath = path.join(sessionDir, "transcripts", `${meta.partFile}.txt`)

  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`字幕がありません: ${path.relative(ROOT, transcriptPath)}\n  先に fetch-transcript.ts を実行してください。`)
  }
  if (fs.existsSync(mdPath) && !force) {
    throw new Error(`${path.relative(ROOT, mdPath)} は既に存在します。抽出をやり直すには --force を付けてください。`)
  }

  const transcript = fs.readFileSync(transcriptPath, "utf-8")
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    throw new Error(
      `字幕が ${transcript.length.toLocaleString()} 字あり、上限 ${MAX_TRANSCRIPT_CHARS.toLocaleString()} 字を超えています。\n` +
      `  議事の区切り（暫時休憩など）で分割して、パートを分けてください。`,
    )
  }

  const client = new Anthropic()
  const system = buildSystemPrompt(meta.partType)
  const frontmatter = buildFrontmatter(meta)

  const messages: Message[] = [{
    role: "user",
    content:
      `次の字幕から ${meta.partType} の本文を抽出してください。\n\n` +
      `- session_id: ${meta.sessionId}\n` +
      `- session_date: ${meta.sessionDate}\n` +
      `- source_url: ${meta.sourceUrl}\n\n` +
      `## 字幕（自動生成・固有名詞の誤認識が多い）\n\n${transcript}`,
  }]

  const total: Usage = { input: 0, output: 0, cacheRead: 0 }
  let lastError: string | null = null

  for (let round = 0; round <= MAX_SELF_CORRECTION_ROUNDS; round++) {
    const label = round === 0 ? "抽出" : `自己修正 ${round}/${MAX_SELF_CORRECTION_ROUNDS}`
    console.log(`   ${label} を実行中…`)

    const { content, text, usage } = await callClaude(client, system, messages)
    total.input += usage.input
    total.output += usage.output
    total.cacheRead += usage.cacheRead
    logUsage(label, usage)

    fs.mkdirSync(sessionDir, { recursive: true })
    fs.writeFileSync(mdPath, `${frontmatter}${stripFences(text)}\n`)

    lastError = validate()
    if (lastError === null) {
      return {
        mdPath,
        rounds: round,
        usage: total,
        needsReview: collectNeedsReview(mdPath),
      }
    }

    if (round === MAX_SELF_CORRECTION_ROUNDS) break

    // 思考ブロックを含む content をそのまま返す（同一モデルでの継続には無改変が必要）
    messages.push({ role: "assistant", content })
    messages.push({
      role: "user",
      content:
        `生成したMDが build:data のバリデーションで落ちました。\n` +
        `本文だけを修正して、全文を再出力してください（frontmatter は書かないこと）。\n\n` +
        `## エラー\n\n${lastError}`,
    })
  }

  throw new Error(
    `${MAX_SELF_CORRECTION_ROUNDS} 回の自己修正でもバリデーションを通りませんでした。\n` +
    `${path.relative(ROOT, mdPath)} を人が直してください（reviewed: false のまま残してあります）。\n\n${lastError}`,
  )
}

/** `【要確認: 〜】` を行番号つきで拾う。PR本文のレビュー項目になる。 */
export function collectNeedsReview(mdPath: string): string[] {
  return fs.readFileSync(mdPath, "utf-8")
    .split("\n")
    .flatMap((line, i) =>
      [...line.matchAll(/【要確認[:：]\s*([^】]*)】/g)].map(m => `${i + 1}行目: 【要確認: ${m[1]}】`),
    )
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const sessionId = get("--session")
  const partFile  = get("--part")
  const type      = get("--type") as PartType | undefined

  if (!sessionId || !partFile || (type !== "qna" && type !== "honkaigi")) {
    throw new Error(
      "使い方: npx tsx scripts/extract-md.ts --session <id> --part day1 --type honkaigi|qna " +
      "[--source-url <url>] [--date YYYY-MM-DD] [--force]",
    )
  }
  return { sessionId, partFile, type, sourceUrl: get("--source-url"), date: get("--date"), force: argv.includes("--force") }
}

/** 未指定の session_date / source_url を content/sessions/{id}/session.yaml から補う。 */
export function resolveMeta(
  sessionId: string,
  partFile: string,
  partType: PartType,
  sourceUrl?: string,
  date?: string,
): Meta {
  const partIndex = partIndexOf(partFile)
  const yamlPath = path.join(CONTENT_DIR, "sessions", sessionId, "session.yaml")

  let session: GikaiSession | null = null
  if (fs.existsSync(yamlPath)) {
    session = yaml.load(fs.readFileSync(yamlPath, "utf-8"), { schema: yaml.CORE_SCHEMA }) as GikaiSession
  }

  const resolvedUrl = sourceUrl ?? session?.parts?.[partIndex]?.youtube
  const resolvedDate = date ?? session?.date

  if (!resolvedUrl) {
    throw new Error(`source_url が決まりません。--source-url を指定するか、${sessionId}/session.yaml の parts[${partIndex}].youtube を埋めてください。`)
  }
  if (!resolvedDate) {
    throw new Error(`session_date が決まりません。--date YYYY-MM-DD を指定してください。`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedDate)) {
    throw new Error(`--date は YYYY-MM-DD 形式です: "${resolvedDate}"`)
  }

  return { sessionId, partFile, partIndex, partType, sessionDate: resolvedDate, sourceUrl: resolvedUrl }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const meta = resolveMeta(args.sessionId, args.partFile, args.type, args.sourceUrl, args.date)
  const result = await extractPart(meta, args.force)

  console.log(`\n✅ ${path.relative(ROOT, result.mdPath)}`)
  console.log(`   自己修正 ${result.rounds} 回`)
  logUsage("合計", result.usage)

  if (result.needsReview.length > 0) {
    console.log(`\n⚠️  要確認 ${result.needsReview.length} 件:`)
    for (const line of result.needsReview) console.log(`   ${line}`)
  }
}

if (path.basename(process.argv[1] ?? "") === "extract-md.ts") {
  main().catch((err) => {
    console.error(`❌ extract-md failed:\n${err instanceof Error ? err.message : err}`)
    process.exit(EXIT.ERROR)
  })
}
