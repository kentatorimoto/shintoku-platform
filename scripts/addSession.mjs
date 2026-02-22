#!/usr/bin/env node
/**
 * scripts/addSession.mjs
 * 議会アーカイブ セッション追加スクリプト
 *
 * 使い方: npm run gikai:add
 *
 * public/data/gikai_sessions.json に新しいセッションを対話形式で追加します。
 */

import { createInterface }                          from "readline"
import { readFileSync, writeFileSync, existsSync }  from "fs"
import { resolve }                                  from "path"

// ── ターミナル色 ───────────────────────────────────────────────────────────
const C = {
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow:(s) => `\x1b[33m${s}\x1b[0m`,
  dim:   (s) => `\x1b[2m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
}

const rl = createInterface({ input: process.stdin, output: process.stdout })

/** 入力プロンプト。defaultValue があれば [デフォルト] を表示し Enter で採用 */
function ask(label, defaultValue = "") {
  const hint = defaultValue ? C.dim(` [${defaultValue}]`) : ""
  return new Promise(res =>
    rl.question(`  ${label}${hint}: `, ans => {
      const v = ans.trim()
      res(v === "" ? defaultValue : v)
    })
  )
}

function section(title) {
  console.log(`\n${C.cyan(`── ${title} `)}`)
}
function log(msg)   { console.log(`  ${msg}`) }
function info(msg)  { console.log(C.dim(`  ${msg}`)) }
function ok(msg)    { console.log(C.green(`  ✅ ${msg}`)) }
function warn(msg)  { console.log(C.yellow(`  ⚠  ${msg}`)) }
function abort(msg) { console.error(C.red(`  ❌ ${msg}`)); rl.close(); process.exit(1) }

// ── メイン ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold("📋 議会アーカイブ セッション追加")}`)
  info("public/data/gikai_sessions.json に新しいセッションを追加します。")
  info("空 Enter でデフォルト値を採用。スキップは「-」を入力。\n")

  const dataPath = resolve("public/data/gikai_sessions.json")

  // 既存データ読み込み
  let sessions = []
  if (existsSync(dataPath)) {
    try {
      sessions = JSON.parse(readFileSync(dataPath, "utf-8"))
    } catch {
      abort("gikai_sessions.json のパースに失敗しました。JSON を確認してください。")
    }
  } else {
    warn("gikai_sessions.json が存在しないため新規作成します。")
  }

  // ────────────────────────────────────────────────────────────────────────
  // 1. 基本情報
  // ────────────────────────────────────────────────────────────────────────
  section("基本情報")

  const dateRaw = await ask("日付 (YYYY-MM-DD)")
  if (!dateRaw.match(/^\d{4}-\d{2}-\d{2}$/)) {
    abort("日付は YYYY-MM-DD 形式で入力してください。")
  }
  const [year, month, day] = dateRaw.split("-")

  const key = await ask("短いキー (例: basic-plan, budget-q1, regular)")
  if (!key || key === "-") abort("キーは必須です。")
  if (!/^[a-z0-9-]+$/.test(key)) abort("キーは半角英小文字・数字・ハイフンのみ使えます。")

  const sessionId = `${year}-${month}-${day}-${key}`
  if (sessions.some(s => s.id === sessionId)) {
    abort(`ID "${sessionId}" は既に存在します。別のキーを使ってください。`)
  }
  info(`→ セッション ID: ${sessionId}`)

  const officialTitle = await ask("正式タイトル")
  if (!officialTitle) abort("正式タイトルは必須です。")

  const narrativeTitle = await ask("見出しタイトル (空 Enter でスキップ)")

  // ────────────────────────────────────────────────────────────────────────
  // 2. サマリー（論点 / 争点 / 次アクション）
  // ────────────────────────────────────────────────────────────────────────
  section("サマリー")
  info("後から JSON を直接編集して修正できます。空 Enter または「-」で省略可。")

  const issues      = await ask("論点（何が議論されたか）")
  const conflicts   = await ask("争点（何が対立したか）")
  const nextActions = await ask("次アクション（何が決まったか・課題は）")

  const summaryEntries = {
    ...(issues      && issues      !== "-" ? { issues }      : {}),
    ...(conflicts   && conflicts   !== "-" ? { conflicts }   : {}),
    ...(nextActions && nextActions !== "-" ? { nextActions } : {}),
  }
  const summary = Object.keys(summaryEntries).length > 0 ? summaryEntries : null

  // ────────────────────────────────────────────────────────────────────────
  // 3. パート構成
  // ────────────────────────────────────────────────────────────────────────
  section("パート構成")
  info("午前/午後、初日/最終日、一般質問 など自由に設定できます。")
  info("YouTube・PDF は「-」でスキップ可。")

  const numPartsRaw = await ask("パート数", "2")
  const numParts = parseInt(numPartsRaw, 10)
  if (isNaN(numParts) || numParts < 1 || numParts > 20) {
    abort("パート数は 1〜20 の整数で入力してください。")
  }

  const parts = []
  for (let i = 0; i < numParts; i++) {
    console.log(`\n${C.dim(`  ── パート ${i + 1} / ${numParts} ──`)}`)

    const label = await ask("  ラベル (例: 午前, 一般質問, 最終日)")
    if (!label || label === "-") abort("ラベルは必須です。")

    const defaultSlidesDir = `part-${i + 1}`
    const slidesDir = await ask("  スライドフォルダ名", defaultSlidesDir)
    if (!slidesDir || slidesDir === "-") abort("スライドフォルダ名は必須です。")
    if (!/^[a-z0-9-]+$/.test(slidesDir)) {
      abort("スライドフォルダ名は半角英小文字・数字・ハイフンのみ使えます。")
    }

    const youtube = await ask("  YouTube URL (スキップ: -)")

    const defaultPdf = `${sessionId}_${slidesDir}.pdf`
    const pdf = await ask("  PDF ファイル名", defaultPdf)

    const part = { label, slidesDir }
    if (youtube && youtube !== "-") part.youtube = youtube
    if (pdf && pdf !== "-")         part.pdf     = pdf

    parts.push(part)
  }

  // ────────────────────────────────────────────────────────────────────────
  // 4. JSON 組み立て
  // ────────────────────────────────────────────────────────────────────────
  const newSession = {
    id: sessionId,
    officialTitle,
    ...(narrativeTitle && narrativeTitle !== "-" ? { narrativeTitle } : {}),
    date: dateRaw,
    ...(summary ? { summary } : {}),
    parts,
  }

  // ────────────────────────────────────────────────────────────────────────
  // 5. プレビュー＆確認
  // ────────────────────────────────────────────────────────────────────────
  section("確認")
  console.log(JSON.stringify(newSession, null, 2))

  const confirm = await ask(`\n追加しますか？ (y/n)`, "n")
  if (confirm.toLowerCase() !== "y") {
    warn("キャンセルしました。")
    rl.close()
    return
  }

  // ────────────────────────────────────────────────────────────────────────
  // 6. 書き込み
  // ────────────────────────────────────────────────────────────────────────
  sessions.push(newSession)
  writeFileSync(dataPath, JSON.stringify(sessions, null, 2) + "\n", "utf-8")

  console.log("")
  ok(`追加完了: ${dataPath}`)
  info(`セッション ID: ${sessionId}`)
  info(`合計: ${sessions.length} 件`)

  const partsWithPdf = parts.filter(p => p.pdf)
  if (partsWithPdf.length > 0) {
    console.log(`\n${C.dim("  スライドを生成する場合:")}`)
    partsWithPdf.forEach(p => info(`npm run slides:generate ${sessionId} ${p.slidesDir}`))
  }

  rl.close()
}

main().catch(err => {
  console.error(C.red("予期しないエラー:"), err)
  rl.close()
  process.exit(1)
})
