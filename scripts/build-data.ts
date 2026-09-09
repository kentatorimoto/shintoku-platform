// 正変換: content/sessions/**（MD正典）→ public/data/*.json
//
//   npx tsx scripts/build-data.ts
//
// 処理契約は docs/content-schema.md §6。
//   - バリデーション失敗時は exit 1 で JSON を一切出力しない
//   - 出力は全て stableStringify を通す（キー順固定・決定的）

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import yaml from "js-yaml"
import { unified } from "unified"
import remarkParse from "remark-parse"
import {
  orderKeys,
  stableStringify,
  validateBook,
  validateCards,
  validateShiseki,
  validateTags,
  type AdministrativeReport,
  type BookMeta,
  type BillItem,
  type BillQuestion,
  type CardsData,
  type CardItem,
  type CommitteeReferral,
  type GikaiSession,
  type HonkaigiData,
  type PartData,
  type QnaData,
  type QnaItem,
  type ShisekiConfidence,
  type ShisekiData,
  type ShisekiItem,
} from "./lib/schema"

const ROOT = process.cwd()

// ── エラー収集 ──────────────────────────────────────────────────────────────

interface BuildIssue {
  file:    string
  line:    number
  message: string
}

class IssueLog {
  readonly errors: BuildIssue[] = []
  readonly warnings: BuildIssue[] = []

  error(file: string, line: number, message: string) {
    this.errors.push({ file, line, message })
  }
  warn(file: string, line: number, message: string) {
    this.warnings.push({ file, line, message })
  }
}

/** レビュー時にそのまま直せるよう「ファイルパス:行番号 + 期待と実際」を必ず含める。 */
function expected(want: string, got: string): string {
  return `${want} が必要ですが、実際には ${got} でした`
}

// ── Markdown AST（必要な部分だけ型付けする）─────────────────────────────────

interface Position { start: { line: number; offset: number }; end: { line: number; offset: number } }
interface MdNode { type: string; position: Position }
interface MdHeading extends MdNode { type: "heading"; depth: number }
interface MdList extends MdNode { type: "list"; children: MdListItem[] }
interface MdListItem extends MdNode { type: "listItem"; children: MdNode[] }
interface MdRoot { type: "root"; children: MdNode[] }

const isHeading = (n: MdNode): n is MdHeading => n.type === "heading"
const isList    = (n: MdNode): n is MdList => n.type === "list"

const parser = unified().use(remarkParse)

// ── YAML（日付の自動変換を無効化。スキーマ §6-5）───────────────────────────

// CORE_SCHEMA は timestamp 型を持たないため、無クォートの 2026-06-03 も文字列のまま読める。
const loadYaml = (src: string): unknown => yaml.load(src, { schema: yaml.CORE_SCHEMA })

export function readFrontmatter(raw: string): { data: Record<string, unknown>; body: string; bodyStartLine: number } {
  const parsed = matter(raw, { engines: { yaml: loadYaml as (s: string) => object } })
  const bodyOffset = raw.length - parsed.content.length
  const bodyStartLine = raw.slice(0, bodyOffset).split("\n").length - 1
  return { data: parsed.data as Record<string, unknown>, body: parsed.content, bodyStartLine }
}

// ── 本文の読み取りヘルパ ────────────────────────────────────────────────────

/**
 * AST ノードに対応する原文をそのまま切り出す。
 * mdast のテキスト化を経由すると `**` や `_` などの記法文字が失われるため（スキーマ §6-4）。
 */
function rawOf(body: string, node: MdNode): string {
  return body.slice(node.position.start.offset, node.position.end.offset)
}

/** リスト項目の本文（`- ` を除いた部分）を1件ずつ返す。 */
function listItems(body: string, list: MdList): string[] {
  return list.children.map(item => {
    const first = item.children[0]
    return first ? dedent(rawOf(body, first)) : ""
  })
}

/** 2行目以降の継続インデントを落とす（リスト項目の note: 行など）。 */
function dedent(text: string): string {
  return text.split("\n").map(l => l.trimStart()).join("\n")
}

const splitCsv = (value: string): string[] =>
  value.split(",").map(v => v.trim()).filter(v => v !== "")

/** `label: value` 形式のメタ行。正規表現の使用はこの用途に限る（スキーマ §6-4）。 */
function metaLine(line: string): { label: string; value: string } | null {
  const m = /^([a-z_]+):\s*(.*)$/.exec(line)
  return m ? { label: m[1], value: m[2].trim() } : null
}

// ── 見出しのパース（スキーマ §4.1 / §5.1）──────────────────────────────────

const headingText = (body: string, node: MdHeading): string =>
  rawOf(body, node).replace(/^#+\s*/, "").trim()

/**
 * `{speaker_name}（{speaker_role}）— {topic_title}`
 * name を貪欲に取ることで、name 自体に「（）」が、role に「—」が現れても壊れない。
 */
const QNA_HEADING = /^(.*)（([^（）]*)）\s*—\s*(.+)$/

/**
 * `{bill_number} — {bill_title}`
 * number を非貪欲に取り、最初の「 — 」を境界として残り全部を title に倒す。
 */
const BILL_HEADING = /^(.+?)\s*—\s*(.+)$/

// ── qna 本文のパース ────────────────────────────────────────────────────────

const emptyQnaItem = (): QnaItem => ({
  speaker_name: "", speaker_role: "", topic_title: "", topic_tags: [],
  question_points: [], answer_summary: "", answer_points: [], conclusion: "",
  continuing_issues: [], mentioned_entities: [], mentioned_numbers: [],
})

const QNA_SUBSECTIONS = ["質問", "答弁", "結論", "継続課題", "言及"]

function parseQnaBody(body: string, bodyStartLine: number, file: string, log: IssueLog): QnaItem[] {
  const root = parser.parse(body) as unknown as MdRoot
  const at = (n: MdNode) => n.position.start.line + bodyStartLine

  const items: QnaItem[] = []
  let item: QnaItem | null = null
  let sub: string | null = null
  let sawSectionHeading = false

  for (const node of root.children) {
    if (isHeading(node)) {
      const text = headingText(body, node)

      if (node.depth === 1) {
        if (text !== "一般質問") {
          log.error(file, at(node), expected('見出し "# 一般質問"', `"# ${text}"`))
        }
        sawSectionHeading = true
        item = null
        sub = null
        continue
      }

      if (node.depth === 2) {
        const m = QNA_HEADING.exec(text)
        if (!m) {
          log.error(file, at(node), expected("見出し `## 名前（役割）— タイトル`", `"## ${text}"`))
          item = null
          sub = null
          continue
        }
        item = emptyQnaItem()
        item.speaker_name = m[1].trim()
        item.speaker_role = m[2].trim()
        item.topic_title  = m[3].trim()
        items.push(item)
        sub = null
        continue
      }

      if (node.depth === 3) {
        if (!item) {
          log.error(file, at(node), `"### ${text}" が議員の見出し（##）より前にあります`)
          continue
        }
        if (!QNA_SUBSECTIONS.includes(text)) {
          log.error(file, at(node), expected(`### ${QNA_SUBSECTIONS.join(" / ### ")}`, `"### ${text}"`))
          sub = null
          continue
        }
        sub = text
        continue
      }

      log.error(file, at(node), expected("見出しレベル 1〜3", `レベル ${node.depth}`))
      continue
    }

    if (!sawSectionHeading) {
      log.error(file, at(node), '本文が "# 一般質問" より前から始まっています')
      continue
    }
    if (!item) continue

    // 見出し直下（sub===null）は tags: メタ行のみ
    if (sub === null) {
      for (const line of rawOf(body, node).split("\n")) {
        const meta = metaLine(line)
        if (meta?.label === "tags") item.topic_tags = splitCsv(meta.value)
        else log.error(file, at(node), expected("`tags:` 行", `"${line}"`))
      }
      continue
    }

    const text = rawOf(body, node)
    switch (sub) {
      case "質問":
        if (isList(node)) item.question_points.push(...listItems(body, node))
        else log.error(file, at(node), expected("`### 質問` 直下に箇条書き", "段落"))
        break

      case "答弁":
        if (isList(node)) item.answer_points.push(...listItems(body, node))
        else if (item.answer_summary === "") item.answer_summary = text
        else log.error(file, at(node), expected("`### 答弁` の段落は1つ", "2つ目の段落"))
        break

      case "結論":
        if (isList(node)) log.error(file, at(node), expected("`### 結論` 直下に段落", "箇条書き"))
        else if (item.conclusion === "") item.conclusion = text
        else log.error(file, at(node), expected("`### 結論` の段落は1つ", "2つ目の段落"))
        break

      case "継続課題":
        if (isList(node)) item.continuing_issues.push(...listItems(body, node))
        else log.error(file, at(node), expected("`### 継続課題` 直下に箇条書き", "段落"))
        break

      case "言及":
        for (const line of text.split("\n")) {
          const meta = metaLine(line)
          if (meta?.label === "entities") item.mentioned_entities = splitCsv(meta.value)
          else if (meta?.label === "numbers") item.mentioned_numbers = splitCsv(meta.value)
          else log.error(file, at(node), expected("`entities:` または `numbers:` 行", `"${line}"`))
        }
        break
    }
  }

  return items
}

// ── honkaigi 本文のパース ───────────────────────────────────────────────────

const emptyBillItem = (): BillItem => ({
  bill_number: "", bill_title: "", bill_tags: [], summary: "", proposer: "",
  questions: [], result: "", result_detail: "", referred_to_committee: false,
})

interface HonkaigiBody {
  items:                  BillItem[]
  committee_referrals:    CommitteeReferral[]
  administrative_reports: AdministrativeReport[]
}

const HONKAIGI_SECTIONS = ["議案審議", "行政報告", "委員会付託"]
const BILL_SUBSECTIONS  = ["概要", "質疑"]

function parseBillMeta(node: MdNode, body: string, item: BillItem, file: string, log: IssueLog) {
  const line0 = node.position.start.line

  rawOf(body, node).split("\n").forEach((line, i) => {
    const meta = metaLine(line)
    if (!meta) {
      log.error(file, line0 + i, expected("`ラベル: 値` 形式のメタ行", `"${line}"`))
      return
    }
    switch (meta.label) {
      case "tags":          item.bill_tags = splitCsv(meta.value); break
      case "proposer":      item.proposer = meta.value; break
      case "result":        item.result = meta.value; break
      case "result_detail": item.result_detail = meta.value; break
      case "referred_to_committee":
        if (meta.value !== "true" && meta.value !== "false") {
          log.error(file, line0 + i, expected("`referred_to_committee: true|false`", `"${meta.value}"`))
        }
        item.referred_to_committee = meta.value === "true"
        break
      default:
        log.error(file, line0 + i, expected(
          "メタ行 `tags: / proposer: / result: / result_detail: / referred_to_committee:`",
          `"${meta.label}:"`
        ))
    }
  })
}

/** `**質問者**` / `Q: 質問` / `A: 答弁` の3行を1件の質疑として読む。 */
function parseBillQuestion(text: string, line: number, file: string, log: IssueLog): BillQuestion | null {
  const lines = text.split("\n")
  if (lines.length !== 3) {
    log.error(file, line, expected("`**質問者**` / `Q: …` / `A: …` の3行", `${lines.length}行`))
    return null
  }
  const questioner = /^\*\*(.+)\*\*$/.exec(lines[0])
  const content    = /^Q:\s*(.*)$/.exec(lines[1])
  const answer     = /^A:\s*(.*)$/.exec(lines[2])

  if (!questioner) { log.error(file, line,     expected("`**質問者**`", `"${lines[0]}"`)); return null }
  if (!content)    { log.error(file, line + 1, expected("`Q: …`", `"${lines[1]}"`)); return null }
  if (!answer)     { log.error(file, line + 2, expected("`A: …`", `"${lines[2]}"`)); return null }

  return { questioner: questioner[1], content: content[1], answer: answer[1] }
}

/** `- 議案第16号, 議案第17号 → 予算特別委員会` + 任意の `note:` 行 */
function parseReferral(text: string, line: number, file: string, log: IssueLog): CommitteeReferral | null {
  const [head, ...rest] = text.split("\n")
  const arrow = head.indexOf("→")
  if (arrow === -1) {
    log.error(file, line, expected("`議案番号 → 委員会名` の箇条書き", `"${head}"`))
    return null
  }

  let note = ""
  for (const line2 of rest) {
    const meta = metaLine(line2)
    if (meta?.label === "note") note = meta.value
    else log.error(file, line, expected("`note:` 行", `"${line2}"`))
  }

  return {
    bill_numbers: splitCsv(head.slice(0, arrow)),
    committee:    head.slice(arrow + 1).trim(),
    note,
  }
}

function parseHonkaigiBody(body: string, bodyStartLine: number, file: string, log: IssueLog): HonkaigiBody {
  const root = parser.parse(body) as unknown as MdRoot
  const at = (n: MdNode) => n.position.start.line + bodyStartLine

  const result: HonkaigiBody = { items: [], committee_referrals: [], administrative_reports: [] }
  let section: string | null = null
  let bill: BillItem | null = null
  let report: AdministrativeReport | null = null
  let sub: string | null = null

  for (const node of root.children) {
    if (isHeading(node)) {
      const text = headingText(body, node)

      if (node.depth === 1) {
        if (!HONKAIGI_SECTIONS.includes(text)) {
          log.error(file, at(node), expected(`# ${HONKAIGI_SECTIONS.join(" / # ")}`, `"# ${text}"`))
        }
        section = text
        bill = null
        report = null
        sub = null
        continue
      }

      if (node.depth === 2) {
        sub = null
        if (section === "議案審議") {
          const m = BILL_HEADING.exec(text)
          if (!m) {
            log.error(file, at(node), expected("見出し `## 議案番号 — 議案名`", `"## ${text}"`))
            bill = null
            continue
          }
          bill = emptyBillItem()
          bill.bill_number = m[1].trim()
          bill.bill_title  = m[2].trim()
          result.items.push(bill)
        } else if (section === "行政報告") {
          report = { title: text, content: "" }
          result.administrative_reports.push(report)
        } else {
          log.error(file, at(node), `"# ${section ?? "(なし)"}" の中に "## ${text}" は書けません`)
        }
        continue
      }

      if (node.depth === 3) {
        if (section !== "議案審議" || !bill) {
          log.error(file, at(node), `"### ${text}" は議案（## 見出し）の中にのみ書けます`)
          continue
        }
        if (!BILL_SUBSECTIONS.includes(text)) {
          log.error(file, at(node), expected(`### ${BILL_SUBSECTIONS.join(" / ### ")}`, `"### ${text}"`))
          sub = null
          continue
        }
        sub = text
        continue
      }

      log.error(file, at(node), expected("見出しレベル 1〜3", `レベル ${node.depth}`))
      continue
    }

    const text = rawOf(body, node)

    if (section === "委員会付託") {
      if (!isList(node)) {
        log.error(file, at(node), expected("`# 委員会付託` 直下に箇条書き", "段落"))
        continue
      }
      for (const [i, itemText] of listItems(body, node).entries()) {
        const referral = parseReferral(itemText, at(node.children[i]), file, log)
        if (referral) result.committee_referrals.push(referral)
      }
      continue
    }

    if (section === "行政報告") {
      if (!report) {
        log.error(file, at(node), '"# 行政報告" 直下には "## 表題" が必要です')
        continue
      }
      report.content = report.content === "" ? text : `${report.content}\n\n${text}`
      continue
    }

    if (section !== "議案審議" || !bill) {
      if (section === null) log.error(file, at(node), '本文が "# 議案審議" より前から始まっています')
      continue
    }

    if (sub === null) {
      parseBillMeta(node, body, bill, file, log)
    } else if (sub === "概要") {
      if (bill.summary === "") bill.summary = text
      else log.error(file, at(node), expected("`### 概要` の段落は1つ", "2つ目の段落"))
    } else if (sub === "質疑") {
      const q = parseBillQuestion(text, at(node), file, log)
      if (q) bill.questions.push(q)
    }
  }

  return result
}

// ── パートMD → JSON ─────────────────────────────────────────────────────────

const REQUIRED_FRONTMATTER = ["session_id", "part_index", "part_type", "session_date", "source_url"]

/** `day1.md` → `{sid}_day1.json` / `part2.md` → `{sid}_part2.json` / `session.md` → `{sid}.json` */
export function mdToJsonName(mdFile: string, sessionId: string): string {
  const base = mdFile.replace(/\.md$/, "")
  return base === "session" ? `${sessionId}.json` : `${sessionId}_${base}.json`
}

function parsePartFile(filePath: string, sessionId: string, log: IssueLog): PartData | null {
  const file = path.relative(ROOT, filePath)
  const mdName = path.basename(filePath)
  const raw = fs.readFileSync(filePath, "utf-8")

  let fm: Record<string, unknown>
  let body: string
  let bodyStartLine: number
  try {
    ({ data: fm, body, bodyStartLine } = readFrontmatter(raw))
  } catch (err) {
    log.error(file, 1, `frontmatter のYAMLが壊れています: ${err instanceof Error ? err.message : err}`)
    return null
  }

  for (const key of REQUIRED_FRONTMATTER) {
    if (fm[key] === undefined) log.error(file, 1, `frontmatter に必須フィールド \`${key}\` がありません`)
  }
  if (fm.session_id !== sessionId) {
    log.error(file, 1, expected(`session_id: ${sessionId}`, `"${String(fm.session_id)}"`))
  }
  if (typeof fm.part_index !== "number") {
    log.error(file, 1, expected("part_index に数値", `"${String(fm.part_index)}"`))
    return null
  }

  // day{n}.md / part{n}.md は part_index === n-1 でなければ getPartData() が拾えない
  const nth = /^(?:day|part)(\d+)$/.exec(mdName.replace(/\.md$/, ""))
  if (nth && fm.part_index !== Number(nth[1]) - 1) {
    log.error(file, 1, expected(`${mdName} なので part_index: ${Number(nth[1]) - 1}`, `${fm.part_index}`))
  }

  const partType = fm.part_type
  if (partType !== "qna" && partType !== "honkaigi") {
    log.error(file, 1, expected('part_type に "qna" または "honkaigi"', `"${String(partType)}"`))
    return null
  }

  const common = {
    session_id:   String(fm.session_id),
    part_index:   fm.part_index,
    session_date: String(fm.session_date),
    source_url:   String(fm.source_url),
  }

  if (partType === "honkaigi") {
    const parsed = parseHonkaigiBody(body, bodyStartLine, file, log)
    const data: HonkaigiData = {
      ...common,
      part_type: "honkaigi",
      source_url: common.source_url,
      items: parsed.items.map(i => orderKeys({
        ...i,
        questions: i.questions.map(q => orderKeys(q, "BillQuestion")),
      }, "BillItem")),
      // 空でも必ず出力する（既存JSON互換。スキーマ §5.3）
      committee_referrals: parsed.committee_referrals.map(c => orderKeys(c, "CommitteeReferral")),
    }
    // 一方 administrative_reports は空ならキーごと省略する
    if (parsed.administrative_reports.length > 0) {
      data.administrative_reports = parsed.administrative_reports.map(r => orderKeys(r, "AdministrativeReport"))
    }
    return orderKeys(data, "HonkaigiData")
  }

  const data: QnaData = {
    ...common,
    // part_type: qna は JSON 出力では省略する（既存挙動互換。スキーマ §3）
    items: parseQnaBody(body, bodyStartLine, file, log).map(i => orderKeys(i, "QnaItem")),
  }

  // _passthrough は一切解釈せず、そのまま復元する（スキーマ §3）
  const passthrough = fm._passthrough as Record<string, unknown> | undefined
  if (passthrough?.topics_index !== undefined) data.topics_index = passthrough.topics_index

  return orderKeys(data, "QnaData")
}

// ── session.yaml → GikaiSession ─────────────────────────────────────────────

const REQUIRED_SESSION_FIELDS = ["id", "officialTitle", "date", "tags", "parts"]

function parseSessionYaml(filePath: string, sessionId: string, log: IssueLog): GikaiSession | null {
  const file = path.relative(ROOT, filePath)
  let parsed: unknown
  try {
    parsed = loadYaml(fs.readFileSync(filePath, "utf-8"))
  } catch (err) {
    log.error(file, 1, `YAMLが壊れています: ${err instanceof Error ? err.message : err}`)
    return null
  }

  const session = parsed as GikaiSession
  for (const key of REQUIRED_SESSION_FIELDS) {
    if ((session as unknown as Record<string, unknown>)[key] === undefined) {
      log.error(file, 1, `必須フィールド \`${key}\` がありません`)
    }
  }
  if (session.id !== sessionId) {
    log.error(file, 1, expected(`id: ${sessionId}（ディレクトリ名と一致）`, `"${session.id}"`))
  }
  if (!Array.isArray(session.tags) || !Array.isArray(session.parts)) return null

  const { errors, warnings } = validateTags(session.tags)
  errors.forEach(e => log.error(file, 1, e))
  warnings.forEach(w => log.warn(file, 1, w))

  return session
}

// ── cards.yaml → CardsData（スキーマ §11）───────────────────────────────────

/** カードはMDの派生物。正典ではないので、無ければ何も出力しないだけで正常。 */
function parseCardsYaml(
  filePath: string,
  sessionId: string,
  partCount: number,
  log: IssueLog,
): CardsData | null {
  const file = path.relative(ROOT, filePath)
  let parsed: unknown
  try {
    parsed = loadYaml(fs.readFileSync(filePath, "utf-8"))
  } catch (err) {
    log.error(file, 1, `YAMLが壊れています: ${err instanceof Error ? err.message : err}`)
    return null
  }

  const { errors, warnings } = validateCards(parsed, sessionId, partCount)
  errors.forEach(e => log.error(file, 1, e))
  warnings.forEach(w => log.warn(file, 1, w))
  if (errors.length > 0) return null

  const data = parsed as CardsData
  return orderKeys({
    session_id:   sessionId,
    generated_by: data.generated_by,
    generated_at: data.generated_at,
    reviewed:     data.reviewed,
    cards:        data.cards.map(c => orderKeys(c, "CardItem") as CardItem),
  }, "CardsData")
}

// ── 郷土資料 archive（スキーマ §12）─────────────────────────────────────────

/** 郷土資料の1冊分。史跡の一覧を持つ本だけが公開対象になる。 */
const SHISEKI_BOOK_ID = "shintoku-shiseki-v1"

/**
 * 議会記録との接続に使わない語（スキーマ §12.7）。
 *
 * 町全体を指す語と町外の地名は、一致しても「その場所が議論された」ことにならない。
 * 例: 「新得」はほぼ全ての議事に出るし、「山形県」は入植元として史跡に出るだけで、
 * 議会側の「山形県」とは別の話をしている。**誤った関連付けは観測装置の信頼を損なう。**
 */
const ENTITY_STOPWORDS = new Set([
  // 町全体・広域
  "新得", "新得町", "十勝", "十勝川", "北海道", "本州", "蝦夷地",
  // 町外の地名
  "帯広", "釧路", "旭川", "札幌", "小樽", "函館", "音更", "鹿追", "清水", "清水町",
  "芽室", "幕別", "上富良野", "落合", "常紋トンネル", "真駒内", "石山", "東京",
])

/** 接続キーとして短すぎる語は使わない（2文字以下は偶然の一致が多い）。 */
const ENTITY_MIN_LENGTH = 3

/**
 * 都道府県・市の名は接続キーにしない。
 * 史跡側では「入植元」として出てくる語（山形県・宮城県）で、議会側の同じ語とは別の話をしている。
 */
const ADMIN_AREA = /(都|道|府|県|市)$/

/** 史跡1件と議会セッションの接続。**完全一致した語だけ**を根拠として持つ。 */
interface SessionLink {
  id:     string
  title:  string
  date:   string
  entity: string
}

const MAX_SESSION_LINKS = 3

/**
 * 史跡の `entities` が議会記録に現れるかを、**部分一致ではなく語の完全一致**で調べる。
 * あいまい一致・語幹の切り出し・推論はしない（仕様書 Phase 4-4）。
 */
function linkSessions(
  entities: string[],
  sessions: GikaiSession[],
  parts: Map<string, PartData>,
): SessionLink[] {
  const keys = entities.filter(e =>
    e.length >= ENTITY_MIN_LENGTH && !ENTITY_STOPWORDS.has(e) && !ADMIN_AREA.test(e),
  )
  if (keys.length === 0) return []

  // セッションごとの検索対象テキスト（メタ＋そのセッションのパート本文）
  const haystack = new Map<string, string>()
  for (const s of sessions) {
    const summary = s.summary
    haystack.set(s.id, [
      s.narrativeTitle ?? "", s.officialTitle, s.tags.join(" "),
      summary?.issues ?? "", summary?.conflicts ?? "", summary?.nextActions ?? "",
    ].join(" "))
  }
  for (const data of parts.values()) {
    const prev = haystack.get(data.session_id) ?? ""
    haystack.set(data.session_id, `${prev} ${JSON.stringify(data)}`)
  }

  const links: SessionLink[] = []
  for (const s of sessions) {
    const text = haystack.get(s.id) ?? ""
    const hit = keys.find(k => text.includes(k))
    if (hit) {
      links.push({ id: s.id, title: s.narrativeTitle ?? s.officialTitle, date: s.date, entity: hit })
    }
  }
  // セッションは既に新しい順。近い会期から最大3件
  return links.slice(0, MAX_SESSION_LINKS)
}

/**
 * `content/archive/shintoku-shiseki/` を読んで公開用データを組み立てる。
 *
 * **本文（OCR全文）はここで捨てる。** 返すのはメタと概要だけで、
 * 呼び出し側が本文を JSON に混ぜられないようにする（権利ガードレール1・4）。
 */
function buildShiseki(
  archiveDir: string,
  log: IssueLog,
  sessions: GikaiSession[],
  parts: Map<string, PartData>,
): ShisekiData | null {
  const dir = path.join(archiveDir, "shintoku-shiseki")
  if (!fs.existsSync(dir)) return null

  const bookPath = path.join(dir, "book.yaml")
  const bookFile = path.relative(ROOT, bookPath)
  if (!fs.existsSync(bookPath)) {
    log.error(path.relative(ROOT, dir), 1, "book.yaml がありません")
    return null
  }

  let bookRaw: unknown
  try {
    bookRaw = loadYaml(fs.readFileSync(bookPath, "utf-8"))
  } catch (err) {
    log.error(bookFile, 1, `YAMLが壊れています: ${err instanceof Error ? err.message : err}`)
    return null
  }

  const bookCheck = validateBook(bookRaw, SHISEKI_BOOK_ID)
  bookCheck.errors.forEach(e => log.error(bookFile, 1, e))
  bookCheck.warnings.forEach(w => log.warn(bookFile, 1, w))
  if (bookCheck.errors.length > 0) return null

  const raw = bookRaw as Record<string, string>
  const book = orderKeys({
    id:            raw.id,
    title:         raw.title,
    publisher:     raw.publisher,
    year:          String(raw.publication_date).slice(0, 4),
    citation:      raw.citation,
    citation_note: raw.citation_note,
  }, "BookMeta") as BookMeta

  const items: ShisekiItem[] = []
  for (const name of fs.readdirSync(dir).filter(f => /^s\d+\.md$/.test(f)).sort()) {
    const file = path.relative(ROOT, path.join(dir, name))
    let fm: Record<string, unknown>
    try {
      ({ data: fm } = readFrontmatter(fs.readFileSync(path.join(dir, name), "utf-8")))
    } catch (err) {
      log.error(file, 1, `frontmatter のYAMLが壊れています: ${err instanceof Error ? err.message : err}`)
      continue
    }

    const check = validateShiseki(fm, name, SHISEKI_BOOK_ID)
    check.errors.forEach(e => log.error(file, 1, e))
    check.warnings.forEach(w => log.warn(file, 1, w))
    if (check.errors.length > 0) continue

    const summary = typeof fm.summary === "string" ? fm.summary.trim() : ""
    const entities = Array.isArray(fm.entities) ? fm.entities as string[] : []
    const sessionLinks = linkSessions(entities, sessions, parts)

    items.push(orderKeys({
      id:         String(fm.id),
      title:      String(fm.title),
      order:      fm.order as number,
      page_start: fm.page_start as number,
      page_end:   typeof fm.page_end === "number" ? fm.page_end : undefined,
      confidence: fm.confidence as ShisekiConfidence,
      reviewed:   fm.reviewed as boolean,
      location:   typeof fm.location === "string" ? fm.location : undefined,
      era:        typeof fm.era === "string" ? fm.era : undefined,
      entities,
      // 未作成なら出力しない。本文は**渡さない**
      summary:    summary === "" ? undefined : summary,
      sessions:   sessionLinks.length > 0 ? sessionLinks : undefined,
    }, "ShisekiItem") as ShisekiItem)
  }

  if (items.length === 0) {
    log.error(path.relative(ROOT, dir), 1, "史跡（s*.md）が1件もありません")
    return null
  }

  items.sort((a, b) => a.order - b.order)
  return orderKeys({ book, items }, "ShisekiData") as ShisekiData
}

// ── ビルド本体 ──────────────────────────────────────────────────────────────

export interface BuildResult {
  sessions: GikaiSession[]
  /** JSON ファイル名 → パートデータ */
  parts:    Map<string, PartData>
  /** セッションID → 要点カード（cards.yaml があるセッションのみ） */
  cards:    Map<string, CardsData>
  /** 郷土資料（史跡）。content/archive/ が無ければ null */
  shiseki:  ShisekiData | null
}

/** `sortDate ?? date` の降順、同値なら id 昇順（スキーマ §2.1）。 */
function sortSessions(sessions: GikaiSession[]): GikaiSession[] {
  return [...sessions].sort((a, b) => {
    const ka = a.sortDate ?? a.date
    const kb = b.sortDate ?? b.date
    return kb.localeCompare(ka) || a.id.localeCompare(b.id)
  })
}

/** content/ を読んでメモリ上に生成物を組み立てる。ファイルは書かない。 */
export function buildFromContent(contentDir: string): BuildResult {
  const log = new IssueLog()
  const sessionsDir = path.join(contentDir, "sessions")
  if (!fs.existsSync(sessionsDir)) {
    throw new Error(`${path.relative(ROOT, sessionsDir)} がありません。先に json-to-md.ts を実行してください。`)
  }

  const sessions: GikaiSession[] = []
  const parts = new Map<string, PartData>()
  const cards = new Map<string, CardsData>()

  const sessionIds = fs.readdirSync(sessionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()

  for (const sessionId of sessionIds) {
    const dir = path.join(sessionsDir, sessionId)

    const yamlPath = path.join(dir, "session.yaml")
    if (!fs.existsSync(yamlPath)) {
      log.error(path.relative(ROOT, dir), 1, "session.yaml がありません")
      continue
    }
    const session = parseSessionYaml(yamlPath, sessionId, log)
    if (session) sessions.push(session)

    for (const mdName of fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort()) {
      const data = parsePartFile(path.join(dir, mdName), sessionId, log)
      if (data) parts.set(mdToJsonName(mdName, sessionId), data)
    }

    const cardsPath = path.join(dir, "cards.yaml")
    if (fs.existsSync(cardsPath)) {
      const data = parseCardsYaml(cardsPath, sessionId, session?.parts.length ?? 0, log)
      if (data) cards.set(sessionId, data)
    }
  }

  const shiseki = buildShiseki(path.join(contentDir, "archive"), log, sortSessions(sessions), parts)

  for (const w of log.warnings) console.warn(`⚠️  ${w.file}:${w.line} ${w.message}`)

  if (log.errors.length > 0) {
    const lines = log.errors.map(e => `  ${e.file}:${e.line}\n    ${e.message}`)
    throw new Error(`バリデーションエラー ${log.errors.length} 件（JSONは出力していません）:\n${lines.join("\n")}`)
  }

  const ordered = sortSessions(sessions).map(s => orderKeys({
    ...s,
    summary: s.summary && orderKeys(s.summary, "Summary"),
    parts:   s.parts.map(p => orderKeys(p, "Part")),
  }, "GikaiSession"))

  return { sessions: ordered, parts, cards, shiseki }
}

// ── エントリポイント ────────────────────────────────────────────────────────

async function main() {
  const result = buildFromContent(path.join(ROOT, "content"))

  const dataDir  = path.join(ROOT, "public", "data")
  const qnaDir   = path.join(dataDir, "qna")
  const cardsDir = path.join(dataDir, "cards")
  fs.mkdirSync(qnaDir, { recursive: true })
  fs.mkdirSync(cardsDir, { recursive: true })

  fs.writeFileSync(path.join(dataDir, "gikai_sessions.json"), stableStringify(result.sessions))
  for (const [name, data] of result.parts) {
    fs.writeFileSync(path.join(qnaDir, name), stableStringify(data))
  }
  for (const [sessionId, data] of result.cards) {
    fs.writeFileSync(path.join(cardsDir, `${sessionId}.json`), stableStringify(data))
  }

  // 郷土資料はメタと概要のみ（権利ガードレール4。本文は buildShiseki が捨てている）
  let shisekiCount = 0
  if (result.shiseki) {
    const archiveDir = path.join(dataDir, "archive")
    fs.mkdirSync(archiveDir, { recursive: true })
    fs.writeFileSync(path.join(archiveDir, "shiseki.json"), stableStringify(result.shiseki))
    shisekiCount = result.shiseki.items.length
  }

  console.log(
    `✅ build:data: ${result.sessions.length} sessions, ${result.parts.size} part files, ` +
    `${result.cards.size} card files, ${shisekiCount} 史跡 → public/data/`,
  )
}

if (path.basename(process.argv[1] ?? "") === "build-data.ts") {
  main().catch((err) => {
    console.error(`build-data failed:\n${err instanceof Error ? err.message : err}`)
    process.exit(1)
  })
}
