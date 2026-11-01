// モデルの出力を、出典を解決して ekimae.json（ページ用）と ekimae.md（人が読む正）に描画する。
//
//   npm run kaigiroku:render -- ekimae
//
// 出典の会議・日付・発言者・ページはモデルに書かせず、抜粋IDから会議録を引いて埋める。

import fs from "fs"
import path from "path"
import type { Excerpt } from "./excerpt"
import type { DatedEntry, SourceRef, TraceResponse } from "./trace-schema"

const ROOT = process.cwd()
const DIR = path.join(ROOT, "content", "traces")
const KAIGIROKU_DIR = path.join(ROOT, "content", "kaigiroku")

interface MapEntry { sessionKey: string; title: string; start: string; pdfUrl: string }

export interface Citation {
  meeting: string
  sessionKey: string
  date: string
  speaker: string
  role: string
  page: number
  url: string
  quote: string
}

const squash = (s: string) => s.replace(/\s+/g, "")

function meetingName(entry: MapEntry): string {
  const year = Number(entry.start.slice(0, 4))
  const era = entry.start >= "2019-05-01"
    ? `令和${year - 2018 === 1 ? "元" : year - 2018}年`
    : `平成${year - 1988}年`
  return `${era} ${entry.title.replace(/[（(].*$/, "").replace(/会議録$/, "").trim()}`
}

function main() {
  const theme = process.argv[2]
  const excerpts = JSON.parse(fs.readFileSync(path.join(DIR, `${theme}.excerpts.json`), "utf-8")) as Excerpt[]
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kaigiroku", "session-map.json"), "utf-8")) as MapEntry[]
  const response = JSON.parse(fs.readFileSync(path.join(DIR, `${theme}.response.json`), "utf-8")) as { model: string; text: string }
  const trace = JSON.parse(response.text) as TraceResponse
  const bySession = new Map(map.map(m => [m.sessionKey, m]))
  const rawPages = new Map<string, string[]>()
  const problems: string[] = []

  /** 引用が実際に載っているページ。長い発言は書き出しのページと違うことがある */
  function pageOfQuote(sessionKey: string, quote: string, fallback: number): number {
    if (!rawPages.has(sessionKey)) {
      const raw = fs.readFileSync(path.join(KAIGIROKU_DIR, sessionKey, "raw.txt"), "utf-8")
      rawPages.set(sessionKey, raw.split("\f").map(p => squash(p.replace(/^[-－ー―]\s*[0-9０-９]+\s*[-－ー―]$/gm, ""))))
    }
    const pages = rawPages.get(sessionKey) ?? []
    const q = squash(quote)
    const onOnePage = pages.findIndex((p, i) => i + 1 >= fallback && p.includes(q))
    const hit = onOnePage >= 0 ? onOnePage : pages.findIndex((p, i) => i + 1 >= fallback && `${p}${pages[i + 1] ?? ""}`.includes(q))
    return hit >= 0 ? hit + 1 : fallback
  }

  function cite(refs: SourceRef[], where: string): Citation[] {
    if (refs.length === 0) problems.push(`出典なし: ${where}`)
    return refs.flatMap((ref) => {
      const e = excerpts[Number(ref.excerpt_id.replace(/^E/, "")) - 1]
      if (!e) { problems.push(`存在しない抜粋ID ${ref.excerpt_id}: ${where}`); return [] }
      const entry = bySession.get(e.sessionKey)
      if (!entry) { problems.push(`対応表に無い会議 ${e.sessionKey}: ${where}`); return [] }
      const page = pageOfQuote(e.sessionKey, ref.quote, e.page)
      return [{
        meeting: meetingName(entry), sessionKey: e.sessionKey, date: e.date, speaker: e.speaker, role: e.role,
        page, url: `${entry.pdfUrl}#page=${page}`, quote: ref.quote,
      }]
    })
  }
  const dated = (d: DatedEntry, where: string) => ({ date: d.date, text: d.text, citations: cite(d.sources, where) })

  const out = {
    title: trace.title,
    reviewed: false,
    extractedBy: response.model,
    firstMention: dated(trace.first_mention, "最初の発言"),
    milestones: [...trace.milestones].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map(m => ({
      date: m.date, kind: m.kind, branches: m.branches, title: m.title, text: m.text, citations: cite(m.sources, m.title),
    })),
    branches: trace.branches.map(b => ({ id: b.id, name: b.name, text: b.text, citations: cite(b.sources, b.name) })),
    recurringQuestions: trace.recurring_questions.map(q => ({
      question: q.question, occurrences: q.occurrences.map(o => dated(o, q.question)),
    })),
    answerChanges: trace.answer_changes.map(q => ({
      topic: q.topic, occurrences: q.occurrences.map(o => dated(o, q.topic)),
    })),
    unknowns: trace.unknowns,
  }
  fs.writeFileSync(path.join(DIR, `${theme}.json`), JSON.stringify(out, null, 2) + "\n")

  const branchName = new Map(out.branches.map(b => [b.id, b.name]))
  const citeLines = (cs: Citation[]) => cs.flatMap(c => [
    `- 出典: ${c.meeting} / ${c.date} / ${c.speaker} ${c.role} / p.${c.page} / ${c.url}`,
    `  - 引用: 「${c.quote}」`,
  ])
  const entryLines = (o: { date: string; text: string; citations: Citation[] }) => [`#### ${o.date}`, "", o.text, "", ...citeLines(o.citations), ""]

  const md = [
    "---",
    `theme: ${theme}`,
    `title: ${JSON.stringify(out.title)}`,
    "reviewed: false",
    `extracted_by: ${response.model}`,
    `extracted_at: "${new Date().toISOString().slice(0, 10)}"`,
    "---",
    `# ${out.title}`,
    "",
    "## 最初に議会で出た発言",
    "",
    ...entryLines(out.firstMention),
    "## 節目（時系列）",
    "",
    ...out.milestones.flatMap(m => [
      `#### ${m.date}【${m.kind}】${m.title}`,
      "",
      `枝: ${m.branches.map(b => branchName.get(b) ?? b).join("・")}`,
      "",
      m.text,
      "",
      ...citeLines(m.citations),
      "",
    ]),
    "## 論点の枝分かれ",
    "",
    ...out.branches.flatMap(b => [`#### ${b.name}`, "", b.text, "", ...citeLines(b.citations), ""]),
    "## 繰り返し出てくる問い",
    "",
    ...out.recurringQuestions.flatMap(q => [`### ${q.question}`, "", ...q.occurrences.flatMap(entryLines)]),
    "## 答弁が変わったところ",
    "",
    ...out.answerChanges.flatMap(q => [`### ${q.topic}`, "", ...q.occurrences.flatMap(entryLines)]),
    "## 抜粋からは読み取れなかったこと",
    "",
    ...out.unknowns.map(u => `- ${u}`),
    "",
  ].join("\n")
  fs.writeFileSync(path.join(DIR, `${theme}.md`), md)

  console.log(`✅ 節目 ${out.milestones.length} / 枝 ${out.branches.length} / 問い ${out.recurringQuestions.length} / 答弁 ${out.answerChanges.length}`)
  if (problems.length > 0) {
    console.error(`❌ ${problems.length} 件の問題`)
    problems.forEach(p => console.error(`  ${p}`))
    process.exit(1)
  }
}

main()
