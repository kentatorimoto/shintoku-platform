// 抜粋を年代順に Claude に渡し、論点の流れを構造化出力で受け取る。**課金される。**
//
//   npm run kaigiroku:trace -- ekimae --dry-run   # 入力サイズと見込み額だけ（count_tokens は無料）
//   npm run kaigiroku:trace -- ekimae             # 生成
//
//   content/traces/{theme}.response.json   モデルの出力と実費

import fs from "fs"
import path from "path"
import Anthropic from "@anthropic-ai/sdk"
import type { Excerpt } from "./excerpt"
import { TRACE_SCHEMA } from "./trace-schema"

const ROOT = process.cwd()
const MODEL = "claude-opus-5-5"
const PRICE_PER_MTOK = { input: 4, output: 20 }
const MAX_OUTPUT_TOKENS = 64_000
/** 了承を得た見込み（約25万字）から大きく外れたら、課金前に止める */
const CHARS_RANGE = [200_000, 320_000]
const MAX_INPUT_USD = 2

const THEME_TITLES: Record<string, string> = {
  ekimae: "駅前の再整備（駅前広場 → 複合施設「とくとく」→ 温浴宿泊施設・町営浴場・金融機関の併設）",
}

async function main() {
  const theme = process.argv[2]
  const dryRun = process.argv.includes("--dry-run")
  if (!THEME_TITLES[theme]) throw new Error(`テーマが無い: ${theme}`)

  const dir = path.join(ROOT, "content", "traces")
  const excerpts = JSON.parse(fs.readFileSync(path.join(dir, `${theme}.excerpts.json`), "utf-8")) as Excerpt[]
  const body = excerpts.map((e, i) =>
    `[E${i + 1}] ${e.date} ${e.sessionKey} 議事: ${e.agenda || "（なし）"} 発言者: ${e.role} ${e.speaker}\n${e.text}`,
  ).join("\n\n")
  const system = fs.readFileSync(path.join(ROOT, "scripts", "prompts", "trace.md"), "utf-8")
  const user = `テーマ: ${THEME_TITLES[theme]}\n\n<excerpts>\n${body}\n</excerpts>`

  const client = new Anthropic()
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }]
  const { input_tokens } = await client.messages.countTokens({ model: MODEL, system, messages })
  const inputUsd = (input_tokens * PRICE_PER_MTOK.input) / 1e6
  console.log(`抜粋 ${excerpts.length} 件 / 入力 ${user.length.toLocaleString()} 字 / ${input_tokens.toLocaleString()} トークン`)
  console.log(`入力の実額 $${inputUsd.toFixed(2)}（出力は上限 ${MAX_OUTPUT_TOKENS.toLocaleString()} トークンで最大 $${((MAX_OUTPUT_TOKENS * PRICE_PER_MTOK.output) / 1e6).toFixed(2)}）`)

  if (user.length < CHARS_RANGE[0] || user.length > CHARS_RANGE[1] || inputUsd > MAX_INPUT_USD) {
    console.error("❌ 見込みから外れているので止めます")
    process.exit(1)
  }
  if (dryRun) return

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system,
    messages,
    output_config: { effort: "high", format: { type: "json_schema", schema: TRACE_SCHEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming)
  const message = await stream.finalMessage()

  const usd = (message.usage.input_tokens * PRICE_PER_MTOK.input + message.usage.output_tokens * PRICE_PER_MTOK.output) / 1e6
  const text = message.content.flatMap(b => (b.type === "text" ? [b.text] : [])).join("")
  fs.writeFileSync(path.join(dir, `${theme}.response.json`), JSON.stringify({
    model: message.model, stop_reason: message.stop_reason, usage: message.usage, usd: Number(usd.toFixed(4)), text,
  }, null, 2) + "\n")

  console.log(`stop_reason=${message.stop_reason} model=${message.model}`)
  console.log(`入力 ${message.usage.input_tokens} / 出力 ${message.usage.output_tokens} トークン → 実費 $${usd.toFixed(2)}`)
  if (message.stop_reason !== "end_turn") {
    console.error("❌ 最後まで生成されませんでした。response.json を確認してください")
    process.exit(1)
  }
  JSON.parse(text)
}

main().catch((err) => {
  console.error("build-trace failed:", err)
  process.exit(1)
})
