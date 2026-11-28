// 広報の中で駅前の語が出るページの一覧を作る。個人の欄として置き換えたページは含まない。
//
//   npm run kaigiroku:koho-pages -- ekimae
//
//   content/traces/{theme}.koho-pages.json

import fs from "fs"
import path from "path"
import { loadKohoIssues } from "./koho-source"

const KEYWORDS = /駅前|複合施設|地域交流センター|交流センター|とくとく|トクトク|温浴|町営浴場|ステラステーション|タウンマネ/

function main() {
  const theme = process.argv[2]
  const rows = loadKohoIssues().flatMap(issue => issue.pages.flatMap((p) => {
    const body = p.text.replace(/\s+/g, "")
    if (!KEYWORDS.test(body)) return []
    return [{ key: issue.key, label: issue.label, page: p.page, url: `${issue.url}#page=${p.page}`, keywords: [...new Set(body.match(new RegExp(KEYWORDS.source, "g")) ?? [])] }]
  }))
  const out = path.join(process.cwd(), "content", "traces", `${theme}.koho-pages.json`)
  fs.writeFileSync(out, `[\n${rows.map(r => JSON.stringify(r)).join(",\n")}\n]\n`)
  console.log(`✅ ${new Set(rows.map(r => r.key)).size} 号・${rows.length} ページ`)
}

main()
