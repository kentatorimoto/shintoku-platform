#!/usr/bin/env node
/**
 * scripts/convertSlides.mjs
 * PDF → JPEG スライド画像変換スクリプト（pdftoppm を使用）
 *
 * 使い方:
 *   npm run slides:generate <sessionId> <slideId>
 *
 * 例:
 *   npm run slides:generate r8-2026-01-20-basic-plan morning
 *   npm run slides:generate r8-2026-01-20-basic-plan afternoon
 *
 * 前提:
 *   poppler がインストール済みであること（macOS: brew install poppler）
 */

import { execSync }                                   from "child_process"
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from "fs"
import { join, resolve }                              from "path"

// ── 引数チェック ────────────────────────────────────────────────────────────
const [sessionId, slideId] = process.argv.slice(2)

if (!sessionId || !slideId) {
  console.error("使い方: npm run slides:generate <sessionId> <slideId>")
  console.error("例:     npm run slides:generate r8-2026-01-20-basic-plan morning")
  process.exit(1)
}

// ── パス解決 ────────────────────────────────────────────────────────────────
const cwd     = resolve(".")
const pdfPath = join(cwd, "public", "pdf", `${sessionId}_${slideId}.pdf`)
const outDir  = join(cwd, "public", "slides", sessionId, slideId)

// ── PDF 存在チェック ────────────────────────────────────────────────────────
if (!existsSync(pdfPath)) {
  console.error(`エラー: PDF が見つかりません: ${pdfPath}`)
  console.error("public/pdf/ ディレクトリに PDF を配置してから実行してください。")
  process.exit(1)
}

// ── 出力ディレクトリ作成 ────────────────────────────────────────────────────
mkdirSync(outDir, { recursive: true })

// ── 既存チェック（page-001.jpg が存在すればスキップ）────────────────────────
const firstPage = join(outDir, "page-001.jpg")
if (existsSync(firstPage)) {
  console.log(`スキップ: ${firstPage} がすでに存在します。`)
  console.log("再生成する場合は出力ディレクトリを削除してから実行してください。")
  console.log(`  rm -rf "${outDir}"`)
  process.exit(0)
}

// ── pdftoppm 存在チェック ───────────────────────────────────────────────────
try {
  execSync("which pdftoppm", { stdio: "ignore" })
} catch {
  console.error("エラー: pdftoppm が見つかりません。")
  console.error("macOS: brew install poppler")
  console.error("Ubuntu: sudo apt-get install poppler-utils")
  process.exit(1)
}

// ── 変換実行（先頭 20 ページ・150 dpi・JPEG）──────────────────────────────
const tmpPrefix = join(outDir, "tmp-page")
console.log(`変換中: ${pdfPath}`)
console.log(`出力先: ${outDir}`)

try {
  execSync(
    `pdftoppm -jpeg -r 150 -l 20 "${pdfPath}" "${tmpPrefix}"`,
    { stdio: "inherit" }
  )
} catch (err) {
  console.error("pdftoppm の実行に失敗しました:", err.message)
  process.exit(1)
}

// ── 出力ファイルを page-NNN.jpg にリネーム ──────────────────────────────────
const tmpFiles = readdirSync(outDir)
  .filter(f => f.startsWith("tmp-page") && f.endsWith(".jpg"))
  .sort()

if (tmpFiles.length === 0) {
  console.error("変換後のファイルが見つかりません。PDF の内容を確認してください。")
  process.exit(1)
}

let count = 0
for (const file of tmpFiles) {
  // pdftoppm の出力: tmp-page-1.jpg / tmp-page-01.jpg / tmp-page-001.jpg etc.
  const match = file.match(/tmp-page-?(\d+)\.jpg$/)
  if (!match) continue

  const num     = parseInt(match[1], 10)
  const newName = `page-${String(num).padStart(3, "0")}.jpg`
  const oldPath = join(outDir, file)
  const newPath = join(outDir, newName)

  if (existsSync(newPath)) {
    console.log(`  スキップ: ${newName}（すでに存在）`)
    unlinkSync(oldPath)   // 一時ファイルを削除
    continue
  }

  renameSync(oldPath, newPath)
  console.log(`  ${file} → ${newName}`)
  count++
}

console.log(`\n完了: ${count} 枚のスライドを生成しました。`)
console.log(`出力先: ${outDir}`)
