// レビュー済みMD（正典）→ cards.yaml（要点カード）を Claude API で生成する。
//
//   npx tsx scripts/generate-cards.ts <sessionId> [--force]
//
// 設計:
//   - **品質ゲートの内側でのみカードを作る。** 全パートMDが reviewed: true でなければ生成しない。
//     カードはMDの派生物であり、未確認の情報を要約の主役にしないため。
//   - ヘッダ（generated_by / generated_at / reviewed）は本スクリプトが決定的に生成し、
//     AIには `cards:` 配下だけを書かせる（extract-md.ts と同じ規律）。
//   - 生成後 build-data のバリデータを走らせ、失敗したらエラーをそのまま返して直させる。

import fs from "fs"
import path from "path"
import Anthropic from "@anthropic-ai/sdk"
import yaml from "js-yaml"
import { buildFromContent, readFrontmatter } from "./build-data"
import {
  callClaude,
  extractSchemaSections,
  logUsage,
  stripFences,
  type Message,
  type Usage,
} from "./extract-md"
import { EXIT, MAX_SELF_CORRECTION_ROUNDS, MODEL } from "./config"
import type { GikaiSession } from "./lib/schema"

const ROOT        = process.cwd()
const CONTENT_DIR = path.join(ROOT, "content")
const SCHEMA_DOC  = path.join(ROOT, "docs", "content-schema.md")
const PROMPT_DIR  = path.join(ROOT, "scripts", "prompts")

// ── 入力の組み立て ──────────────────────────────────────────────────────────

interface PartSource {
  /** day1 / part2 / session */
  file:      string
  partIndex: number
  label:     string
  body:      string
}

/** `day1.md` → 0 / `part3.md` → 2 / `session.md` → 0（スキーマ §1） */
function partIndexOfFile(mdName: string): number {
  const base = mdName.replace(/\.md$/, "")
  const m = /^(?:day|part)(\d+)$/.exec(base)
  return m ? Number(m[1]) - 1 : 0
}

/**
 * 全パートMDを読む。1つでも reviewed: true でなければエラー。
 * カードは「照合レビュー済みコンテンツの派生物」という前提を、ここで機械的に守る。
 */
function readReviewedParts(sessionDir: string, session: GikaiSession): PartSource[] {
  const mdNames = fs.readdirSync(sessionDir).filter(f => f.endsWith(".md")).sort()
  if (mdNames.length === 0) {
    throw new Error(`${path.relative(ROOT, sessionDir)} にパートMDがありません`)
  }

  const unreviewed: string[] = []
  const parts: PartSource[] = []

  for (const mdName of mdNames) {
    const raw = fs.readFileSync(path.join(sessionDir, mdName), "utf-8")
    const { data, body } = readFrontmatter(raw)
    if (data.reviewed !== true) {
      unreviewed.push(mdName)
      continue
    }
    const partIndex = partIndexOfFile(mdName)
    parts.push({
      file:  mdName,
      partIndex,
      label: session.parts[partIndex]?.label ?? `パート${partIndex + 1}`,
      body:  body.trim(),
    })
  }

  if (unreviewed.length > 0) {
    throw new Error(
      `レビューが終わっていないパートがあります: ${unreviewed.join(", ")}\n` +
      `  カードはレビュー済みMDの派生物です。frontmatter を reviewed: true にしてから実行してください。`,
    )
  }
  return parts
}

function buildSystemPrompt(): string {
  const template = fs.readFileSync(path.join(PROMPT_DIR, "cards.md"), "utf-8")
  const schemaDoc = fs.readFileSync(SCHEMA_DOC, "utf-8")
  // §11 が cards.yaml のスキーマ
  return template.replace("{{SCHEMA}}", extractSchemaSections(schemaDoc, [11]))
}

function buildUserMessage(session: GikaiSession, parts: PartSource[]): string {
  const meta = [
    `- session_id: ${session.id}`,
    `- 会議名: ${session.officialTitle}`,
    session.narrativeTitle ? `- 見出し: ${session.narrativeTitle}` : null,
    `- 日付: ${session.date}`,
    `- タグ: ${session.tags.join(", ")}`,
    session.summary ? `- 論点: ${session.summary.issues}` : null,
    session.summary?.conflicts ? `- 争点: ${session.summary.conflicts}` : null,
    session.summary?.nextActions ? `- 次アクション: ${session.summary.nextActions}` : null,
  ].filter(line => line !== null).join("\n")

  const bodies = parts.map(p =>
    `## パート${p.partIndex}「${p.label}」\n` +
    `link に使うパス: /gikai/sessions/${session.id}/${p.partIndex}\n\n` +
    p.body,
  ).join("\n\n---\n\n")

  return (
    `次の会議録から要点カードを作ってください。\n\n` +
    `## セッション\n\n${meta}\n\n` +
    `## 会議録（レビュー済み・正典）\n\n${bodies}`
  )
}

// ── ヘッダの生成 ────────────────────────────────────────────────────────────

function buildHeader(today: string): string {
  return [
    `generated_by: ${MODEL}`,
    `generated_at: "${today}"`,
    // カード自体も人間が確認して true にする
    "reviewed: false",
    "",
  ].join("\n")
}

/** AIが書いた `cards:` ブロックだけを取り出す（ヘッダを書いてしまった場合に備える）。 */
function stripHeader(text: string): string {
  const i = text.indexOf("cards:")
  return i === -1 ? text : text.slice(i)
}

// ── 生成本体 ────────────────────────────────────────────────────────────────

export interface GenerateResult {
  cardsPath: string
  rounds:    number
  usage:     Usage
  titles:    string[]
}

export async function generateCards(
  sessionId: string,
  today: string,
  force = false,
): Promise<GenerateResult> {
  const sessionDir = path.join(CONTENT_DIR, "sessions", sessionId)
  const yamlPath   = path.join(sessionDir, "session.yaml")
  const cardsPath  = path.join(sessionDir, "cards.yaml")

  if (!fs.existsSync(yamlPath)) {
    throw new Error(`${path.relative(ROOT, yamlPath)} がありません。セッションIDを確認してください。`)
  }
  if (fs.existsSync(cardsPath) && !force) {
    throw new Error(
      `${path.relative(ROOT, cardsPath)} は既に存在します。\n` +
      `  作り直すには --force を付けてください（人が直した内容は失われます）。`,
    )
  }

  const session = yaml.load(fs.readFileSync(yamlPath, "utf-8"), { schema: yaml.CORE_SCHEMA }) as GikaiSession
  const parts = readReviewedParts(sessionDir, session)
  console.log(`   レビュー済みパート ${parts.length}件: ${parts.map(p => p.file).join(", ")}`)

  const client = new Anthropic()
  const system = buildSystemPrompt()
  const header = buildHeader(today)

  const messages: Message[] = [{ role: "user", content: buildUserMessage(session, parts) }]
  const total: Usage = { input: 0, output: 0, cacheRead: 0 }
  let lastError: string | null = null

  for (let round = 0; round <= MAX_SELF_CORRECTION_ROUNDS; round++) {
    const label = round === 0 ? "生成" : `自己修正 ${round}/${MAX_SELF_CORRECTION_ROUNDS}`
    console.log(`   ${label} を実行中…`)

    const { content, text, usage } = await callClaude(client, system, messages)
    total.input += usage.input
    total.output += usage.output
    total.cacheRead += usage.cacheRead
    logUsage(label, usage)

    fs.writeFileSync(cardsPath, `${header}${stripHeader(stripFences(text))}\n`)

    lastError = validate()
    if (lastError === null) {
      return { cardsPath, rounds: round, usage: total, titles: cardTitles(cardsPath) }
    }

    if (round === MAX_SELF_CORRECTION_ROUNDS) break

    messages.push({ role: "assistant", content })
    messages.push({
      role: "user",
      content:
        `生成した cards.yaml が build:data のバリデーションで落ちました。\n` +
        `\`cards:\` 以下を修正して、全文を再出力してください（ヘッダは書かないこと）。\n\n` +
        `## エラー\n\n${lastError}`,
    })
  }

  throw new Error(
    `${MAX_SELF_CORRECTION_ROUNDS} 回の自己修正でもバリデーションを通りませんでした。\n` +
    `${path.relative(ROOT, cardsPath)} を人が直してください。\n\n${lastError}`,
  )
}

/** 書き込んだ cards.yaml が build:data を通るか検証する。JSONは書かない。 */
function validate(): string | null {
  try {
    buildFromContent(CONTENT_DIR)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

/** レビュー用に「kind — title」を並べて返す。 */
function cardTitles(cardsPath: string): string[] {
  const data = yaml.load(fs.readFileSync(cardsPath, "utf-8"), { schema: yaml.CORE_SCHEMA }) as {
    cards: { kind: string; title: string; value?: string }[]
  }
  return data.cards.map(c => `${c.kind.padEnd(8)} ${c.value ? `${c.value} — ` : ""}${c.title}`)
}

// ── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2)
  const sessionId = argv.find(a => !a.startsWith("--"))
  if (!sessionId) {
    throw new Error("使い方: npm run cards:generate -- <sessionId> [--force]")
  }

  const today = new Date().toISOString().slice(0, 10)
  const result = await generateCards(sessionId, today, argv.includes("--force"))

  console.log(`\n✅ ${path.relative(ROOT, result.cardsPath)}`)
  console.log(`   自己修正 ${result.rounds} 回`)
  logUsage("合計", result.usage)
  console.log(`\n📇 カード ${result.titles.length}枚:`)
  for (const line of result.titles) console.log(`   ${line}`)
  console.log(`\n   内容を確認したら reviewed: true に変えてコミットしてください。`)
}

if (path.basename(process.argv[1] ?? "") === "generate-cards.ts") {
  main().catch((err) => {
    console.error(`❌ cards:generate failed:\n${err instanceof Error ? err.message : err}`)
    process.exit(EXIT.ERROR)
  })
}
