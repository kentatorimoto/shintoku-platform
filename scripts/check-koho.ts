// 月号が各月1号そろっているかを検査する。お知らせ号は数えない。
//
//   npm run koho:check

import fs from "fs"
import path from "path"
import type { KohoIssue } from "./lib/koho-issue"
import { maskedReason, personalReason } from "./lib/koho-personal"

const issues = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "koho", "index.json"), "utf-8")) as KohoIssue[]
const monthly = issues.filter(i => i.kind === "monthly")
const have = new Set(monthly.map(i => i.key))
const keys = [...have].sort()
const first = keys[0]
const last = keys[keys.length - 1]

const missing: string[] = []
let [y, m] = first.split("-").map(Number)
const end = last
for (;;) {
  const k = `${y}-${String(m).padStart(2, "0")}`
  if (!have.has(k)) missing.push(k)
  if (k === end) break
  m++
  if (m > 12) { m = 1; y++ }
}

const text = issues.filter(i => i.status === "text")
console.log(`月号 ${monthly.length}（${first}〜${last}）/ お知らせ号 ${issues.length - monthly.length}`)
console.log(`取り込み ${text.length} 号 / ${text.reduce((n, i) => n + (i.pages ?? 0), 0).toLocaleString()} ページ / ${text.reduce((n, i) => n + (i.chars ?? 0), 0).toLocaleString()} 字`)
console.log(`文字なし ${issues.filter(i => i.status === "no-text").length} 号: ${issues.filter(i => i.status === "no-text").map(i => i.key).join(", ")}`)
console.log(`一部のページに文字なし: ${text.filter(i => i.blankPages.length > 0).map(i => `${i.key}(${i.blankPages.length}/${i.pages})`).join(", ")}`)
console.log(`未取得 ${issues.filter(i => i.status === "pending").length} 号`)
console.log(`抜けている月 ${missing.length}: ${missing.join(", ") || "なし"}`)

// 名前の欄が本文に残っていたら失敗にする
const leaks = text.flatMap(i => fs.readFileSync(path.join(process.cwd(), "content", "koho", i.key, "raw.txt"), "utf-8").split("\f")
  .flatMap((p, n) => (!maskedReason(p) && personalReason(p) ? [`${i.key} p.${n + 1}`] : [])))
console.log(`個人の欄が残るページ ${leaks.length}: ${leaks.join(", ") || "なし"}`)
if (leaks.length > 0) process.exit(1)
