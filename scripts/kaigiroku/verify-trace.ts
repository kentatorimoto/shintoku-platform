// {theme}.md の出典がすべて会議録に実在するかを機械的に検査する。生成・描画のコードに依存しない。
//
//   npm run kaigiroku:verify -- ekimae
//
// 検査: 1. すべての #### 記述に出典があるか
//       2. 出典の会議・日付・発言者・役職に合う発言が speeches.json にあり、引用がその本文と一字一句一致するか
//       3. ページが、引用の載っている raw.txt のページと一致するか
//       4. URLが町のPDFのURLと一致するか

import fs from "fs"
import path from "path"
import { corpusPath } from "../lib/corpus"

const ROOT = process.cwd()
const squash = (s: string) => s.replace(/\s+/g, "")

interface SpeechRow { date: string; speaker: string; role: string; page: number; text: string }

function main() {
  const theme = process.argv[2]
  const md = fs.readFileSync(path.join(ROOT, "content", "traces", `${theme}.md`), "utf-8")
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kaigiroku", "session-map.json"), "utf-8")) as { sessionKey: string; pdfUrl: string }[]
  const keyByUrl = new Map(map.map(m => [m.pdfUrl, m.sessionKey]))

  const failures: string[] = []
  let citations = 0
  let entries = 0
  let spanning = 0
  const lines = md.split("\n")
  let entry = ""
  let entryCited = true

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith("#### ")) {
      if (!entryCited) failures.push(`出典なし: ${entry}`)
      entry = line
      entryCited = false
      entries++
      continue
    }
    if (line.startsWith("## ") || line.startsWith("### ")) {
      if (!entryCited) failures.push(`出典なし: ${entry}`)
      entryCited = true
      continue
    }
    if (!line.startsWith("- 出典: ")) continue

    citations++
    entryCited = true
    const at = `${entry} L${i + 1}`
    const m = /^- 出典: (.+?) \/ (\d{4}-\d{2}-\d{2}) \/ (\S+) (\S+) \/ p\.(\d+) \/ (\S+)#page=(\d+)$/.exec(line)
    const q = /^ {2}- 引用: 「(.*)」$/.exec(lines[i + 1] ?? "")
    if (!m || !q) { failures.push(`形式が違う: ${at}`); continue }
    const [, , date, speaker, role, pageText, url, urlPage] = m
    const quote = squash(q[1])

    const key = keyByUrl.get(url)
    if (!key) { failures.push(`町のURLに無い: ${url} ${at}`); continue }
    if (pageText !== urlPage) failures.push(`p.とURLのページが違う: ${at}`)

    const dir = corpusPath("kaigiroku", key)
    const speeches = JSON.parse(fs.readFileSync(path.join(dir, "speeches.json"), "utf-8")) as SpeechRow[]
    const same = speeches.filter(s => s.date === date && s.speaker === speaker && s.role === role)
    if (same.length === 0) { failures.push(`発言者が無い: ${key} ${date} ${speaker} ${role} ${at}`); continue }

    const said = same.filter(s => squash(s.text).includes(quote))
    if (said.length === 0) { failures.push(`引用が本文と一致しない: 「${q[1]}」 ${key} ${speaker} ${at}`); continue }

    const page = Number(pageText)
    // ページ末尾のノンブル（- 12 -）を除く。引用がページをまたぐときは次のページとつなげて探す
    const pages = fs.readFileSync(path.join(dir, "raw.txt"), "utf-8").split("\f")
      .map(p => squash(p.replace(/^[-－ー―]\s*[0-9０-９]+\s*[-－ー―]$/gm, "")))
    const onPage = (pages[page - 1] ?? "").includes(quote)
    // 次のページに丸ごと載っている引用は「またぎ」ではなく、ページの誤り
    const spans = !onPage && !(pages[page] ?? "").includes(quote) && `${pages[page - 1] ?? ""}${pages[page] ?? ""}`.includes(quote)
    if (spans) spanning++
    if (!onPage && !spans) failures.push(`引用がそのページに無い: p.${page} ${key} ${at}`)
  }
  if (!entryCited) failures.push(`出典なし: ${entry}`)

  console.log(`記述 ${entries} / 出典 ${citations} / ページまたぎ ${spanning} / 不合格 ${failures.length}`)
  failures.forEach(f => console.log(`  ${f}`))
  if (failures.length > 0) process.exit(1)
}

main()
