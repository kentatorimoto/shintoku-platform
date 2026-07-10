// 逆変換: 既存の public/data/*.json → content/sessions/**（MD正典）
//
//   npx tsx scripts/json-to-md.ts             全セッション
//   npx tsx scripts/json-to-md.ts <sessionId> 単一セッション
//
// 移行用の使い捨てスクリプト。正典が content/ に移った後は使わない。
// 出力形式は docs/content-schema.md v1.2（§2〜§5）に準拠する。

import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import {
  isHonkaigi,
  type BillItem,
  type GikaiSession,
  type PartData,
  type QnaItem,
} from "../lib/schema"

const ROOT         = process.cwd()
const SESSIONS_JSON = path.join(ROOT, "public", "data", "gikai_sessions.json")
const QNA_DIR       = path.join(ROOT, "public", "data", "qna")

// ── 警告収集 ────────────────────────────────────────────────────────────────

export interface Warning {
  file:    string
  path:    string
  message: string
  value:   string
}

class WarningLog {
  readonly items: Warning[] = []

  add(file: string, jsonPath: string, message: string, value: string) {
    this.items.push({ file, path: jsonPath, message, value })
  }

  /** 見出し・メタ行の記法を壊しうる文字列を検出する（手動確認の対象になる）。 */
  checkInline(file: string, jsonPath: string, value: string) {
    if (value.includes("\n")) {
      this.add(file, jsonPath, "改行を含むため1行メタとして書き出せません", value)
    }
    if (/^\s*[-#>]/.test(value)) {
      this.add(file, jsonPath, "行頭がMarkdownの記法文字です", value)
    }
  }

  checkCsvItem(file: string, jsonPath: string, value: string) {
    this.checkInline(file, jsonPath, value)
    if (value.includes(",")) {
      this.add(file, jsonPath, "カンマ区切りの要素にカンマが含まれています", value)
    }
  }
}

// ── YAML ────────────────────────────────────────────────────────────────────

/**
 * js-yaml の既定スキーマは "2026-06-03" のような曖昧な平文をクォートして出力する。
 * これに任せることで「日付は必ずクォート」の規約が自動的に守られる（スキーマ §6-5）。
 */
function dumpYaml(value: unknown): string {
  return yaml.dump(value, { lineWidth: -1, noRefs: true, quoteStyle: "double" })
}

// ── session.yaml ────────────────────────────────────────────────────────────

export function sessionToYaml(session: GikaiSession): string {
  // キー順はスキーマ §2 の例と揃える。
  const out: Record<string, unknown> = {
    id:            session.id,
    officialTitle: session.officialTitle,
  }
  if (session.narrativeTitle !== undefined) out.narrativeTitle = session.narrativeTitle
  out.date = session.date
  if (session.sortDate !== undefined) out.sortDate = session.sortDate
  out.tags = session.tags
  if (session.summary !== undefined) out.summary = session.summary
  out.parts = session.parts

  return dumpYaml(out)
}

// ── パートMD ────────────────────────────────────────────────────────────────

interface FrontmatterMeta {
  extractedBy: string
  extractedAt: string
  reviewed:    boolean
}

function buildFrontmatter(data: PartData, meta: FrontmatterMeta): string {
  const fm: Record<string, unknown> = {
    session_id:   data.session_id,
    part_index:   data.part_index,
    // 既存JSONでは一般質問の part_type は未指定。MDでは常に明示する（スキーマ §3）。
    part_type:    isHonkaigi(data) ? "honkaigi" : "qna",
    session_date: data.session_date,
    source_url:   data.source_url,
    extracted_by: meta.extractedBy,
    extracted_at: meta.extractedAt,
    reviewed:     meta.reviewed,
  }

  // 本文構造に対応先を持たないフィールドは _passthrough へ無加工で退避する（スキーマ §3）。
  if (!isHonkaigi(data) && data.topics_index !== undefined) {
    fm._passthrough = { topics_index: data.topics_index }
  }

  return `---\n${dumpYaml(fm)}---\n`
}

function csvLine(label: string, values: string[]): string[] {
  return values.length > 0 ? [`${label}: ${values.join(", ")}`] : []
}

function qnaItemToMd(item: QnaItem, log: WarningLog, file: string, i: number): string {
  const at = (field: string) => `items[${i}].${field}`

  log.checkInline(file, at("speaker_name"), item.speaker_name)
  log.checkInline(file, at("topic_title"), item.topic_title)
  if (item.speaker_role.includes("（") || item.speaker_role.includes("）")) {
    log.add(file, at("speaker_role"), "役割に丸括弧が含まれ、見出しの区切りと衝突します", item.speaker_role)
  }
  if (item.topic_title.includes(" — ")) {
    log.add(file, at("topic_title"), "タイトルに ' — ' が含まれ、見出しの区切りと衝突します", item.topic_title)
  }
  item.topic_tags.forEach((t, j) => log.checkCsvItem(file, at(`topic_tags[${j}]`), t))
  item.mentioned_entities.forEach((v, j) => log.checkCsvItem(file, at(`mentioned_entities[${j}]`), v))
  item.mentioned_numbers.forEach((v, j) => log.checkCsvItem(file, at(`mentioned_numbers[${j}]`), v))
  item.question_points.forEach((v, j) => log.checkInline(file, at(`question_points[${j}]`), v))
  item.answer_points.forEach((v, j) => log.checkInline(file, at(`answer_points[${j}]`), v))
  item.continuing_issues.forEach((v, j) => log.checkInline(file, at(`continuing_issues[${j}]`), v))

  const lines: string[] = []

  // speaker_role が空でも （） は必ず書く（スキーマ §4.1）
  lines.push(`## ${item.speaker_name}（${item.speaker_role}）— ${item.topic_title}`, "")

  if (item.topic_tags.length > 0) {
    lines.push(`tags: ${item.topic_tags.join(", ")}`, "")
  }

  if (item.question_points.length > 0) {
    lines.push("### 質問")
    lines.push(...item.question_points.map(p => `- ${p}`))
    lines.push("")
  }

  if (item.answer_summary !== "" || item.answer_points.length > 0) {
    lines.push("### 答弁")
    if (item.answer_summary !== "") lines.push(item.answer_summary, "")
    if (item.answer_points.length > 0) {
      lines.push(...item.answer_points.map(p => `- ${p}`))
      lines.push("")
    }
  }

  if (item.conclusion !== "") {
    lines.push("### 結論", item.conclusion, "")
  }

  if (item.continuing_issues.length > 0) {
    lines.push("### 継続課題")
    lines.push(...item.continuing_issues.map(p => `- ${p}`))
    lines.push("")
  }

  const mentions = [
    ...csvLine("entities", item.mentioned_entities),
    ...csvLine("numbers", item.mentioned_numbers),
  ]
  if (mentions.length > 0) {
    lines.push("### 言及", ...mentions, "")
  }

  return lines.join("\n")
}

function billItemToMd(item: BillItem, log: WarningLog, file: string, i: number): string {
  const at = (field: string) => `items[${i}].${field}`

  log.checkInline(file, at("bill_number"), item.bill_number)
  log.checkInline(file, at("bill_title"), item.bill_title)
  if (item.bill_number.includes(" — ")) {
    log.add(file, at("bill_number"), "議案番号に ' — ' が含まれ、見出しの区切りと衝突します", item.bill_number)
  }
  item.bill_tags.forEach((t, j) => log.checkCsvItem(file, at(`bill_tags[${j}]`), t))
  log.checkInline(file, at("proposer"), item.proposer)
  log.checkInline(file, at("result"), item.result)
  log.checkInline(file, at("result_detail"), item.result_detail)
  item.questions.forEach((q, j) => {
    log.checkInline(file, at(`questions[${j}].questioner`), q.questioner)
    log.checkInline(file, at(`questions[${j}].content`), q.content)
    log.checkInline(file, at(`questions[${j}].answer`), q.answer)
  })

  const lines: string[] = []
  lines.push(`## ${item.bill_number} — ${item.bill_title}`, "")

  // メタ行の順序は固定。値が空なら行ごと省略する（スキーマ §5.2）。
  const meta: string[] = [
    ...csvLine("tags", item.bill_tags),
    ...(item.proposer      !== "" ? [`proposer: ${item.proposer}`] : []),
    ...(item.result        !== "" ? [`result: ${item.result}`] : []),
    ...(item.result_detail !== "" ? [`result_detail: ${item.result_detail}`] : []),
    `referred_to_committee: ${item.referred_to_committee}`,
  ]
  lines.push(...meta, "")

  if (item.summary !== "") {
    lines.push("### 概要", item.summary, "")
  }

  if (item.questions.length > 0) {
    lines.push("### 質疑")
    for (const q of item.questions) {
      lines.push(`**${q.questioner}**`, `Q: ${q.content}`, `A: ${q.answer}`, "")
    }
  }

  return lines.join("\n")
}

export function partToMd(data: PartData, meta: FrontmatterMeta, log: WarningLog, file: string): string {
  const chunks: string[] = [buildFrontmatter(data, meta), ""]

  if (isHonkaigi(data)) {
    chunks.push("# 議案審議", "")
    data.items.forEach((item, i) => chunks.push(billItemToMd(item, log, file, i)))

    const reports = data.administrative_reports ?? []
    if (reports.length > 0) {
      chunks.push("# 行政報告", "")
      reports.forEach((r, i) => {
        log.checkInline(file, `administrative_reports[${i}].title`, r.title)
        chunks.push(`## ${r.title}`, "", r.content, "")
      })
    }

    if (data.committee_referrals.length > 0) {
      chunks.push("# 委員会付託", "")
      data.committee_referrals.forEach((c, i) => {
        c.bill_numbers.forEach((b, j) => {
          log.checkCsvItem(file, `committee_referrals[${i}].bill_numbers[${j}]`, b)
          if (b.includes("→")) {
            log.add(file, `committee_referrals[${i}].bill_numbers[${j}]`, "議案番号に '→' が含まれ、区切りと衝突します", b)
          }
        })
        log.checkInline(file, `committee_referrals[${i}].committee`, c.committee)
        log.checkInline(file, `committee_referrals[${i}].note`, c.note)

        chunks.push(`- ${c.bill_numbers.join(", ")} → ${c.committee}`)
        if (c.note !== "") chunks.push(`  note: ${c.note}`)
      })
      chunks.push("")
    }
  } else {
    chunks.push("# 一般質問", "")
    data.items.forEach((item, i) => chunks.push(qnaItemToMd(item, log, file, i)))
  }

  // 段落間の空行を1つに正規化し、末尾を単一改行で終える。
  return chunks.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "\n")
}

// ── ファイル名の対応（スキーマ §1）─────────────────────────────────────────

/** `{sid}_day1.json` → `day1.md` / `{sid}_part2.json` → `part2.md` / `{sid}.json` → `session.md` */
export function jsonToMdName(jsonFile: string, sessionId: string): string {
  const base = jsonFile.replace(/\.json$/, "")
  if (base === sessionId) return "session.md"
  const suffix = base.slice(sessionId.length + 1) // "_" を飛ばす
  return `${suffix}.md`
}

function partFilesOf(sessionId: string): string[] {
  if (!fs.existsSync(QNA_DIR)) return []
  return fs
    .readdirSync(QNA_DIR)
    .filter(f => f.endsWith(".json"))
    .filter(f => f === `${sessionId}.json` || f.startsWith(`${sessionId}_`))
    .sort()
}

// ── sortDate の決定（スキーマ §2.1）─────────────────────────────────────────

function sortSessions(sessions: GikaiSession[]): GikaiSession[] {
  return [...sessions].sort((a, b) => {
    const ka = a.sortDate ?? a.date
    const kb = b.sortDate ?? b.date
    return kb.localeCompare(ka) || a.id.localeCompare(b.id)
  })
}

const idsOf = (sessions: GikaiSession[]) => sessions.map(s => s.id).join("|")

/**
 * `date` 単独のソートで既存の配列順を再現できないセッションにのみ sortDate を与える。
 *
 * 逆転 `sessions[i].date < sessions[i+1].date` は「i+1 が本来もっと前の日付を持つ会期」を意味する。
 * その会期初日（パートJSONの最も早い session_date）を sortDate に採る。
 */
function assignSortDates(sessions: GikaiSession[], partDates: Map<string, string[]>): void {
  if (idsOf(sortSessions(sessions)) === idsOf(sessions)) return

  for (let i = 0; i < sessions.length - 1; i++) {
    if (sessions[i].date >= sessions[i + 1].date) continue

    const target = sessions[i + 1]
    const dates  = partDates.get(target.id) ?? []
    if (dates.length === 0) {
      throw new Error(
        `${target.id}: 既存の配列順が日付降順と食い違いますが、会期初日を決められません` +
        `（public/data/qna/ にパートデータがありません）。session.yaml に sortDate を手で与えてください。`
      )
    }
    target.sortDate = dates.reduce((min, d) => (d < min ? d : min))
    console.log(`  sortDate: ${target.id} → "${target.sortDate}"（会期初日。既存の並び順を保存）`)
  }

  const sorted = sortSessions(sessions)
  if (idsOf(sorted) !== idsOf(sessions)) {
    const before = sessions.map(s => `${s.sortDate ?? s.date} ${s.id}`)
    const after  = sorted.map(s => `${s.sortDate ?? s.date} ${s.id}`)
    throw new Error(
      "sortDate を与えても既存の配列順を再現できませんでした。\n" +
      `  期待（既存JSONの順）:\n    ${before.join("\n    ")}\n` +
      `  実際（sortDate降順）:\n    ${after.join("\n    ")}`
    )
  }
}

// ── 変換本体 ────────────────────────────────────────────────────────────────

export interface ConvertResult {
  sessions: number
  parts:    number
  warnings: Warning[]
}

export function convertAll(contentDir: string, onlySessionId?: string): ConvertResult {
  const sessions: GikaiSession[] = JSON.parse(fs.readFileSync(SESSIONS_JSON, "utf-8"))
  const log = new WarningLog()

  // sortDate の決定には全セッションの並びが要る（単一セッション指定でも先に全体を解決する）。
  const partDates = new Map<string, string[]>()
  for (const s of sessions) {
    const dates = partFilesOf(s.id).map(f => {
      const d: PartData = JSON.parse(fs.readFileSync(path.join(QNA_DIR, f), "utf-8"))
      return d.session_date
    })
    if (dates.length > 0) partDates.set(s.id, dates)
  }
  assignSortDates(sessions, partDates)

  const targets = onlySessionId ? sessions.filter(s => s.id === onlySessionId) : sessions
  if (targets.length === 0) throw new Error(`セッションが見つかりません: ${onlySessionId}`)

  const extractedAt = new Date().toISOString().slice(0, 10)
  const meta: FrontmatterMeta = {
    // 既存JSONは公開済み = レビュー済み相当として扱う。
    extractedBy: "migrated-from-json",
    extractedAt,
    reviewed:    true,
  }

  let partCount = 0
  for (const session of targets) {
    const dir = path.join(contentDir, "sessions", session.id)
    fs.mkdirSync(path.join(dir, "transcripts"), { recursive: true })
    // Layer 0（字幕生データ）の置き場を先に用意しておく。
    fs.writeFileSync(path.join(dir, "transcripts", ".gitkeep"), "")

    fs.writeFileSync(path.join(dir, "session.yaml"), sessionToYaml(session))

    for (const jsonFile of partFilesOf(session.id)) {
      const data: PartData = JSON.parse(fs.readFileSync(path.join(QNA_DIR, jsonFile), "utf-8"))
      const mdName = jsonToMdName(jsonFile, session.id)
      fs.writeFileSync(path.join(dir, mdName), partToMd(data, meta, log, jsonFile))
      partCount++
    }
  }

  return { sessions: targets.length, parts: partCount, warnings: log.items }
}

// ── エントリポイント ────────────────────────────────────────────────────────

async function main() {
  const onlySessionId = process.argv[2]
  const contentDir = path.join(ROOT, "content")

  const result = convertAll(contentDir, onlySessionId)

  if (result.warnings.length > 0) {
    console.warn(`\n⚠️  ${result.warnings.length} 件の要確認箇所（変換は続行しました）:`)
    for (const w of result.warnings) {
      console.warn(`  ${w.file} ${w.path}: ${w.message}`)
      console.warn(`    → ${JSON.stringify(w.value)}`)
    }
  }

  console.log(`\n✅ json-to-md: ${result.sessions} sessions, ${result.parts} part files → ${path.relative(ROOT, contentDir)}/`)
}

// roundtrip-test から import されたときは実行しない
if (path.basename(process.argv[1] ?? "") === "json-to-md.ts") {
  main().catch((err) => {
    console.error("json-to-md failed:", err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
