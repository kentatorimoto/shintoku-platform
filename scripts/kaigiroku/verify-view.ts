// view.json の出典をすべて集め、発言者・引用・ページ・URL を会議録に照らして検査する。
//
//   npm run kaigiroku:verify-view -- ekimae

import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const squash = (s: string) => s.replace(/\s+/g, "")
interface Citation { kind?: string; meeting: string; sessionKey: string; speechIndex: number; date: string; speaker: string; role: string; page: number; url: string; quote: string }

function main() {
  const theme = process.argv[2]
  const view = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "traces", `${theme}.view.json`), "utf-8"))
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kaigiroku", "session-map.json"), "utf-8")) as { sessionKey: string; pdfUrl: string }[]
  const urlOf = new Map(map.map(m => [m.sessionKey, m.pdfUrl]))

  const citations: Citation[] = []
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk)
    else if (o && typeof o === "object") {
      if ("speechIndex" in o) citations.push(o as Citation)
      else Object.values(o).forEach(walk)
    }
  }
  walk(view)

  const failures: string[] = []
  const issues = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", "newsletters_index.json"), "utf-8")) as
    { date: string; url: string; pages: { page: number; text: string }[] }[]
  for (const c of citations) {
    if (c.kind === "koho") {
      const at = `広報 ${c.date} p.${c.page}`
      const issue = issues.find(i => i.date === c.date)
      const page = issue?.pages.find(p => p.page === c.page)
      if (!issue || !page) { failures.push(`広報の号かページが無い ${at}`); continue }
      if (!squash(page.text).includes(squash(c.quote))) failures.push(`広報の引用が本文に無い ${at}`)
      if (c.url !== `${issue.url}#page=${c.page}`) failures.push(`広報のURLが違う ${at}`)
      continue
    }
    const dir = path.join(ROOT, "content", "kaigiroku", c.sessionKey)
    const s = (JSON.parse(fs.readFileSync(path.join(dir, "speeches.json"), "utf-8")) as { date: string; speaker: string; role: string; text: string }[])[c.speechIndex]
    const at = `${c.sessionKey}#${c.speechIndex} p.${c.page}`
    if (!s) { failures.push(`発言が無い ${at}`); continue }
    if (s.speaker !== c.speaker || s.role !== c.role || s.date !== c.date) failures.push(`発言者か日付が違う ${at}`)
    if (!squash(s.text).includes(squash(c.quote))) failures.push(`引用が本文に無い ${at} 「${c.quote}」`)
    if (c.url !== `${urlOf.get(c.sessionKey)}#page=${c.page}`) failures.push(`URLが違う ${at}`)
    const pages = fs.readFileSync(path.join(dir, "raw.txt"), "utf-8").split("\f").map(p => squash(p.replace(/^[-－ー―]\s*[0-9０-９]+\s*[-－ー―]$/gm, "")))
    const q = squash(c.quote)
    if (q && !(pages[c.page - 1] ?? "").includes(q) && !`${pages[c.page - 1] ?? ""}${pages[c.page] ?? ""}`.includes(q)) failures.push(`引用がそのページに無い ${at}`)
    if (!q && !(pages[c.page - 1] ?? "").includes(squash(`${c.speaker}${c.role}`))) failures.push(`発言者がそのページに無い ${at}`)
  }
  const pointsWithoutUrl = (view.points as { label: string; citation?: Citation }[]).filter(p => !p.citation?.url)
  pointsWithoutUrl.forEach(p => failures.push(`出典の無い点 ${p.label}`))

  const excerpts = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "traces", `${theme}.excerpts.json`), "utf-8")) as { date: string }[]
  for (const q of view.quietYears as { year: number; count: number }[]) {
    if (excerpts.filter(e => e.date.slice(0, 4) === String(q.year)).length !== q.count) failures.push(`発言件数が違う ${q.year}`)
    if ((view.points as { date: string }[]).some(p => p.date.slice(0, 4) === String(q.year))) failures.push(`点がある年 ${q.year}`)
  }

  console.log(`出典 ${citations.length} 件 / 点 ${view.points.length} / 不合格 ${failures.length}`)
  failures.forEach(f => console.log(`  ${f}`))
  if (failures.length > 0) process.exit(1)
}

main()
