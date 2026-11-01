// 生成済みの流れと speeches.json から、1発言1件の event を起こす。**API は呼ばない。**
//
//   npm run kaigiroku:events -- ekimae
//
// 層・行為・金額・因果は発言の原文から規則で決める。生成結果から使うのは
// 「どの発言を選んだか」（抜粋IDと引用）と、まとまりの名前、object の補完だけ。

import fs from "fs"
import path from "path"
import type { Excerpt } from "./excerpt"
import type { Speech } from "./extract"
import type { SourceRef, TraceResponse } from "./trace-schema"
import {
  ACTION_PHRASES, CHAIR_ROLE, FALLBACK_ACTION, KOHO_ACTOR, MEMBER_ROLE, OBJECTS,
  type EventCause, type Layer, type TraceEvent, type TraceObject,
} from "./event-schema"

const ROOT = process.cwd()
const DIR = path.join(ROOT, "content", "traces")
const squash = (s: string) => s.replace(/\s+/g, "")
const toHalf = (s: string) => s.replace(/[０-９，]/g, c => (c === "，" ? "," : String.fromCharCode(c.charCodeAt(0) - 0xfee0)))

const OBJECT_WORDS: Record<TraceObject, RegExp> = {
  とくとく本体: /とくとく|複合施設|交流センター/,
  温浴宿泊施設: /温浴|宿泊施設|ホテル/,
  町営浴場: /町営浴場|駅前温泉/,
  金融機関: /金融機関|信金|信用金庫|銀行/,
  指定管理: /指定管理|タウンマネ|まちづくり会社/,
  駅前広場: /駅前広場|ロータリー|駅前再整備|駅周辺|駅前周辺/,
}
const BRANCH_OBJECT: Record<string, TraceObject> = {
  whole: "駅前広場", tokutoku: "とくとく本体", onyoku: "温浴宿泊施設", yokujo: "町営浴場", kinyu: "金融機関", shitei: "指定管理",
}

/** 理由を述べる言い回し。「〜するため」（目的）や「規定により」（根拠）は因果ではないので拾わない */
const CAUSE_MARKERS = [
  /の影響(?:で|により|を受け)/,
  /ことから/,
  /を理由に/,
  /(?:を|を再度|などを再度|などを)考慮し/,
  /に伴い(?:まして)?/,
  /(?:悪化|増加|減少|不足|老朽化|高騰|遅れ|都合|関係)のため/,
  /(?:した|いた|なった|あった|された|れた|ない|ある|いる|できる)ため/,
  /(?:おります|あります|ございます|ました|ません|ない|ある)ので、/,
]
const GUESS = /思われ|と思い|と思って|と考え|見込み|おそらく|かもしれ|のではないか|だろう|ようです|想定(?!より)|予想|恐れ|懸念/
/** 議員が、町や文書の説明を引いて述べている文の終わり方 */
const QUOTING = /(ということでありました|ということでした|とのことでした|と書かれており?ま?し?た?|というふうに書かれておりました)。?$/
const HEARSAY = /伺って|と聞いて|とのこと/
const REASONING = /理由|考え|思い|方針|判断|想定|見込み|検討|期待|認識/
const FACTUAL = /議案|計上|契約|提案|議決|可決|開所|オープン|着手|着工|完成|\d+月\d+日|[０-９]+月[０-９]+日/

function sentenceOf(text: string, quote: string): string | null {
  const flat = squash(text)
  const at = flat.indexOf(squash(quote))
  if (at < 0) return null
  const start = flat.lastIndexOf("。", at - 1) + 1
  const end = flat.indexOf("。", at + squash(quote).length - 1)
  return flat.slice(start, end < 0 ? flat.length : end + 1)
}

function causesOf(sentence: string, statedBy: string, isMember: boolean): EventCause[] {
  // 議員の「〜なので質問します」は出来事の理由ではない。町や文書の説明を引いた文だけ、伝聞として残す
  const quoting = QUOTING.test(sentence)
  if (isMember && !quoting) return []
  for (const marker of CAUSE_MARKERS) {
    const m = marker.exec(sentence)
    if (!m) continue
    const reason = sentence.slice(0, m.index + (m[0].startsWith("の影響") ? 3 : m[0].length - markerTail(m[0]))).trim()
    const effect = sentence.slice(m.index + m[0].length).replace(/^[、]/, "")
    // 結果が空の文（〜ためです）は、何の理由かを文から読めないので因果にしない
    if (reason.length < 4 || (!effect && !quoting)) continue
    return [{
      reason, marker: m[0], effect,
      certainty: GUESS.test(reason) ? "推測" : "断定",
      hearsay: isMember || HEARSAY.test(reason),
      scope: "同じ文",
      stated_by: statedBy,
    }]
  }
  return []
}
/** 増額や延期の理由は、議案の説明で直前の文に述べられることがある。結果の語が合う文だけ拾う */
const EFFECT_WORDS = /変更|増額|減額|遅れ|延期|ずれ込|上昇/
const LOOK_BACK_SENTENCES = 3

function causesBefore(speechText: string, sentence: string, statedBy: string): EventCause[] {
  const flat = squash(speechText)
  const before = flat.slice(0, Math.max(0, flat.indexOf(sentence))).split(/(?<=。)/).filter(Boolean)
  for (const prev of before.slice(-LOOK_BACK_SENTENCES).reverse()) {
    const [cause] = causesOf(prev, statedBy, false)
    if (cause && EFFECT_WORDS.test(cause.effect)) return [{ ...cause, scope: "前の文" }]
  }
  return []
}

/** reason に含めない、つなぎ語の長さ */
function markerTail(marker: string): number {
  const tail = /(ことから|を理由に|(?:を|を再度|などを再度|などを)考慮し|に伴い(?:まして)?|のため|ため|ので、)$/.exec(marker)
  return tail ? tail[0].length : 0
}

function amountsOf(sentence: string): TraceEvent["amounts"] {
  const out: TraceEvent["amounts"] = []
  const half = toHalf(sentence)
  for (const m of half.matchAll(/(約|およそ)?(?:(\d[\d,]*)億)?(?:(\d[\d,]*)万)?(\d[\d,]*)?円/g)) {
    if (!m[2] && !m[3] && !m[4]) continue
    const n = (v?: string) => Number((v ?? "0").replace(/,/g, ""))
    out.push({ raw: m[0], yen: n(m[2]) * 1e8 + n(m[3]) * 1e4 + n(m[4]), approx: Boolean(m[1]) })
  }
  return out
}

/** 行為そのものが確かなもの。理由が添えられていても fact で、理由は causes に持つ */
const HARD_ACTIONS = new Set(["白紙", "延期", "増額", "減額", "契約変更", "契約", "開所", "閉鎖", "着工", "完成", "条例制定", "指定", "用地取得", "予算計上"])

function layerOf(role: string, sentence: string, action: string | null, hasAmount: boolean): Layer {
  if (MEMBER_ROLE.test(role)) return "debate"
  if (CHAIR_ROLE.test(role)) return "fact"
  if (hasAmount || (action !== null && HARD_ACTIONS.has(action))) return "fact"
  if (REASONING.test(sentence)) return "interpretation"
  return FACTUAL.test(sentence) ? "fact" : "interpretation"
}

/** 変更の行為。「に伴い」を理由と読むのと、直前の文まで理由を探すのは、これだけ */
const NEEDS_REASON = new Set(["増額", "減額", "延期", "白紙", "契約変更"])
const NOT_ACTION = /早期着手|早期着工|着手すべき/

/** 引用そのものの語を優先する。一文に複数の行為があるとき、選ばれた発言の焦点に合わせるため */
function actionOf(quote: string, sentence: string, layer: Layer): { action: string | null; phrase: string | null } {
  for (const text of [quote, sentence]) {
    const target = text.replace(NOT_ACTION, "")
    for (const { action, phrases } of ACTION_PHRASES) {
      const phrase = phrases.find(p => target.includes(p))
      if (phrase) return { action, phrase }
    }
  }
  if (layer === "fact") return { action: null, phrase: null }
  return { action: FALLBACK_ACTION[layer], phrase: null }
}

/** 実施済みの報告か、これからの予定か。読み取れないものは null */
function tenseOf(sentence: string): TraceEvent["tense"] {
  // 「増設予定でありました」は、これからの予定ではない
  const body = sentence.replace(/予定であり(まし)?た|予定でした/g, "")
  if (/予定|見込み|計画しております|てまいります|ていきます|ていく考え|考えております|する方針/.test(body)) return "予定"
  if (/ました。$|いたしました|完了|締結いたし/.test(sentence)) return "実施"
  return null
}

// ── 広報しんとく ────────────────────────────────────────────────────────────

const KOHO_SUBJECT = /駅前周辺再整備|駅前再整備|駅前広場|駅前複合施設|複合施設|とくとく|地域交流センター|温浴宿泊|温浴施設|町営浴場|タウンマネ|ステラステーション/
/** 日付と事実が書かれた記事の語 */
const KOHO_ACT = /起工|安全祈願|地鎮祭|竣工|完成|オープン|開所|開業|開館|閉館|着工|着手|工事が始ま|工事を開始|延期|ずれ込|白紙|指定管理者|供用|解体/
/** 町の考えや効果の説明の語 */
const KOHO_VIEW = /賑わい|にぎわい|交流人口|コンセプト|目的|を目指/
/** 町の説明でないもの（投稿・編集後記・質問）と、別の話題 */
const KOHO_NOT_TOWN = /[▼●]|編集後記|ちなみに|モニター|ご意見|質問|どうにか|でしょうか|ですか/
const KOHO_OTHER = /文化会館|屋台村|そば祭り|植栽|回数券|商品券|出店費用|ジオラマ|観光協会事務所|生活応援|感謝祭|記念祭|場所[：:]|日時|役場庁舎|新庁舎|診療情報|思います|[・…]P\d|火夫の像|駅ピアノ|夏休み/
const QUOTE_RADIUS = 45
const QUOTE_MIN_SENTENCE = 12
const QUOTE_MAX_SENTENCE = 400

function kohoStatedDate(text: string, issueDate: string): string | null {
  const era = /令和(\d+)年(\d+)月(?:(\d+)日)?/.exec(toHalf(text))
  if (era) return `${2018 + Number(era[1])}-${era[2].padStart(2, "0")}${era[3] ? `-${era[3].padStart(2, "0")}` : ""}`
  const md = /(\d{1,2})月(\d{1,2})日/.exec(toHalf(text))
  return md ? `${issueDate.slice(0, 4)}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}` : null
}

/** 索引の本文を文に切り、規則に当たる文だけ event にする。引用は索引の本文から空白を除いた抜き出し */
function kohoEvents(): TraceEvent[] {
  const issues = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", "newsletters_index.json"), "utf-8")) as
    { title: string; date: string; url: string; pages: { page: number; text: string }[] }[]
  const seen = new Set<string>()
  const out: TraceEvent[] = []

  for (const issue of [...issues].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const p of issue.pages) {
      if (!KOHO_SUBJECT.test(p.text)) continue
      for (const raw of p.text.split(/(?<=。)/)) {
        const sentence = squash(raw)
        if (sentence.length < QUOTE_MIN_SENTENCE || sentence.length > QUOTE_MAX_SENTENCE || seen.has(sentence)) continue
        if (!KOHO_SUBJECT.test(sentence) || KOHO_NOT_TOWN.test(sentence) || KOHO_OTHER.test(sentence)) continue
        const actAt = sentence.search(KOHO_ACT)
        const viewAt = sentence.search(KOHO_VIEW)
        if (actAt < 0 && viewAt < 0) continue
        seen.add(sentence)

        const at = actAt >= 0 ? actAt : viewAt
        const layer: Layer = actAt >= 0 ? "fact" : "interpretation"
        const quote = sentence.slice(Math.max(0, at - QUOTE_RADIUS), at + QUOTE_RADIUS)
        const textObjects = OBJECTS.filter(o => OBJECT_WORDS[o].test(quote))
        const objects = textObjects.length > 0 ? textObjects : OBJECTS.filter(o => OBJECT_WORDS[o].test(sentence))
        const { action, phrase } = layer === "fact" ? actionOf(quote, sentence, layer) : { action: FALLBACK_ACTION.interpretation, phrase: null }
        const label = /令和\S+?[号月]/.exec(issue.title)?.[0] ?? issue.title
        out.push({
          id: "", source_type: "koho", layer, action, action_phrase: phrase, tense: tenseOf(sentence),
          actor: KOHO_ACTOR, objects, object_source: objects.length > 0 ? "text" : null,
          date: issue.date, stated_date: kohoStatedDate(quote, issue.date),
          amounts: amountsOf(sentence),
          // 広報の本文は別の記事とつながることがあるので、理由と読むのは語の確かなものだけ
          causes: causesOf(sentence, KOHO_ACTOR.name, false).filter(c => /の影響|ことから/.test(c.marker)),
          source: {
            excerpt_id: null, session_key: null, speech_index: null, issue: `広報しんとく ${label}`, page: p.page,
            url: `${issue.url}#page=${p.page}`, agenda: "", quote, sentence,
          },
          bill: null, result: null, groups: [], derived_from: [{ section: "koho", title: label }],
        })
      }
    }
  }
  return out
}

function main() {
  const theme = process.argv[2]
  const excerpts = JSON.parse(fs.readFileSync(path.join(DIR, `${theme}.excerpts.json`), "utf-8")) as Excerpt[]
  const trace = JSON.parse(JSON.parse(fs.readFileSync(path.join(DIR, `${theme}.response.json`), "utf-8")).text) as TraceResponse
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kaigiroku", "session-map.json"), "utf-8")) as { sessionKey: string; pdfUrl: string }[]
  const urlOf = new Map(map.map(m => [m.sessionKey, m.pdfUrl]))
  const speechCache = new Map<string, Speech[]>()
  const rawCache = new Map<string, string[]>()

  const speechesOf = (key: string) => {
    if (!speechCache.has(key)) speechCache.set(key, JSON.parse(fs.readFileSync(path.join(ROOT, "content", "kaigiroku", key, "speeches.json"), "utf-8")))
    return speechCache.get(key) ?? []
  }
  const pageOf = (key: string, quote: string, from: number) => {
    if (!rawCache.has(key)) {
      rawCache.set(key, fs.readFileSync(path.join(ROOT, "content", "kaigiroku", key, "raw.txt"), "utf-8").split("\f")
        .map(p => squash(p.replace(/^[-－ー―]\s*[0-9０-９]+\s*[-－ー―]$/gm, ""))))
    }
    const pages = rawCache.get(key) ?? []
    const q = squash(quote)
    const one = pages.findIndex((p, i) => i + 1 >= from && p.includes(q))
    const hit = one >= 0 ? one : pages.findIndex((p, i) => i + 1 >= from && `${p}${pages[i + 1] ?? ""}`.includes(q))
    return hit >= 0 ? hit + 1 : from
  }

  const events = new Map<string, TraceEvent>()
  const unresolved: string[] = []

  function add(ref: SourceRef, section: string, title: string, branches: string[], group: string | null, statedDate: string | null) {
    const e = excerpts[Number(ref.excerpt_id.replace(/^E/, "")) - 1]
    if (!e) { unresolved.push(`抜粋IDが無い ${ref.excerpt_id}`); return }
    const speeches = speechesOf(e.sessionKey)
    const q = squash(ref.quote)
    const index = speeches.findIndex(s => s.date === e.date && s.speaker === e.speaker && s.role === e.role && squash(s.text).includes(q))
    if (index < 0) { unresolved.push(`発言が見つからない ${ref.excerpt_id}: ${ref.quote}`); return }

    const key = `${e.sessionKey}#${index}#${q}`
    const seen = events.get(key)
    const from = { section, title }
    if (seen) {
      seen.derived_from.push(from)
      if (group && !seen.groups.includes(group)) seen.groups.push(group)
      if (seen.objects.length === 0 && branches.length > 0) {
        seen.objects = [...new Set(branches.flatMap(b => BRANCH_OBJECT[b] ?? []))]
        seen.object_source = "parent"
      }
      seen.stated_date ??= statedDate !== e.date ? statedDate : null
      return
    }

    const s = speeches[index]
    const sentence = sentenceOf(s.text, ref.quote) ?? ref.quote
    const statedBy = `${s.speaker} ${s.role}`
    const rawAction = actionOf(squash(ref.quote), sentence, "debate").action
    // 「〜の開設に伴い、規定に基づき」のような定型文を因果にしない。「に伴い」は変更の行為に限る
    let causes = causesOf(sentence, statedBy, MEMBER_ROLE.test(s.role))
      .filter(c => !c.marker.startsWith("に伴い") || (rawAction !== null && NEEDS_REASON.has(rawAction)))
    const amounts = amountsOf(sentence)
    const layer = layerOf(s.role, sentence, rawAction, amounts.length > 0)
    const { action, phrase } = actionOf(squash(ref.quote), sentence, layer)
    if (causes.length === 0 && !MEMBER_ROLE.test(s.role) && action && NEEDS_REASON.has(action)) {
      causes = causesBefore(s.text, sentence, statedBy)
    }
    // 引用の中の語を優先する。「駅前周辺再整備」は事業全体の呼び名なので、施設名があれば駅前広場には載せない
    const objectsIn = (text: string) => {
      const found = OBJECTS.filter(o => OBJECT_WORDS[o].test(text))
      const specific = found.filter(o => o !== "駅前広場")
      return specific.length > 0 && !/駅前広場|ロータリー/.test(text) ? specific : found
    }
    const quoteObjects = objectsIn(squash(ref.quote))
    const textObjects = quoteObjects.length > 0 ? quoteObjects : objectsIn(sentence)
    const parentObjects = [...new Set(branches.flatMap(b => BRANCH_OBJECT[b] ?? []))]
    const objects = textObjects.length > 0 ? textObjects : parentObjects
    const page = pageOf(e.sessionKey, ref.quote, s.page)
    // 「議案第16号から議案第25号まで」のような一括議題は、どの議案の発言か決められない
    const bill = /議案第[0-9０-９]+号から/.test(s.agenda) ? undefined : /(議案第[0-9０-９]+号)/.exec(s.agenda)?.[1]

    events.set(key, {
      id: "", source_type: "kaigiroku",
      layer, action, action_phrase: phrase, tense: tenseOf(sentence),
      actor: { name: s.speaker, role: s.role },
      objects,
      object_source: textObjects.length > 0 ? "text" : parentObjects.length > 0 ? "parent" : null,
      date: s.date,
      stated_date: statedDate && statedDate !== s.date ? statedDate : null,
      amounts, causes,
      source: {
        excerpt_id: ref.excerpt_id, session_key: e.sessionKey, speech_index: index, issue: null, page,
        url: `${urlOf.get(e.sessionKey)}#page=${page}`, agenda: s.agenda, quote: ref.quote, sentence,
      },
      bill: bill ? toHalf(bill) : null,
      result: null,
      groups: group ? [group] : [],
      derived_from: [from],
    })
  }

  const m0 = trace.first_mention
  m0.sources.forEach(r => add(r, "first_mention", "最初の発言", [], null, null))
  for (const m of trace.milestones) m.sources.forEach(r => add(r, "milestones", m.title, m.branches, null, m.date))
  for (const b of trace.branches) b.sources.forEach(r => add(r, "branches", b.name, [b.id], null, null))
  for (const q of trace.recurring_questions) for (const o of q.occurrences) o.sources.forEach(r => add(r, "recurring_questions", q.question, [], `問い: ${q.question}`, null))
  for (const q of trace.answer_changes) for (const o of q.occurrences) o.sources.forEach(r => add(r, "answer_changes", q.topic, [], `答弁: ${q.topic}`, null))

  // 議案に触れた発言があれば、その議案の採決結果を speeches.json から別の fact として起こす
  const bills = new Map<string, TraceEvent>()
  for (const ev of events.values()) if (ev.bill) bills.set(`${ev.source.session_key}#${ev.bill}`, ev)
  let billsWithoutResult = 0
  for (const ev of bills.values()) {
    const num = toHalf(ev.bill ?? "")
    // 特別委員会は付託審査なので、採決は本会議の側にある
    const sessionKey = (ev.source.session_key ?? "")
      .replace("yosan-tokubetsu", "regular-1").replace("kessan-tokubetsu", "regular-3")
    if (!urlOf.has(sessionKey)) { billsWithoutResult++; continue }
    const speeches = speechesOf(sessionKey)
    const index = speeches.findIndex(s => CHAIR_ROLE.test(s.role)
      && /(可決|否決|承認|認定|同意)(され|することに決)/.test(s.text)
      && new RegExp(`${num}(?![0-9])`).test(toHalf(s.text)))
    if (index < 0) { billsWithoutResult++; continue }
    const s = speeches[index]
    const flat = squash(s.text)
    const at = flat.search(/(可決|否決|承認|認定|同意)(され|することに決)/)
    const sentence = flat.slice(flat.lastIndexOf("。", at) + 1, flat.indexOf("。", at) + 1)
    const page = pageOf(sessionKey, sentence, s.page)
    const key = `${sessionKey}#${index}#${sentence}`
    if (events.has(key)) continue
    events.set(key, {
      id: "", source_type: "kaigiroku", layer: "fact", action: "議決", action_phrase: /(可決|否決|承認|認定|同意)/.exec(sentence)?.[1] ?? null, tense: "実施",
      actor: { name: s.speaker, role: s.role },
      objects: ev.objects, object_source: ev.object_source,
      date: s.date, stated_date: null, amounts: [], causes: [],
      source: {
        excerpt_id: null, session_key: sessionKey, speech_index: index, issue: null, page,
        url: `${urlOf.get(sessionKey)}#page=${page}`, agenda: s.agenda, quote: sentence, sentence,
      },
      bill: ev.bill, result: /(可決|否決|承認|認定|同意)/.exec(sentence)?.[1] ?? null,
      groups: [], derived_from: [{ section: "speeches", title: `${ev.bill}の採決` }],
    })
  }

  const koho = kohoEvents()
  const list = [...events.values(), ...koho].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.source.page - b.source.page || (a.source.speech_index ?? 0) - (b.source.speech_index ?? 0))
  list.forEach((e, i) => { e.id = `ev-${String(i + 1).padStart(4, "0")}` })
  fs.writeFileSync(path.join(DIR, `${theme}.events.json`), `[\n${list.map(e => JSON.stringify(e)).join(",\n")}\n]\n`)

  // 言い回し → 行為の対応表（語彙の全件と、今回実際に出た件数）
  const counts = new Map<string, number>()
  for (const e of list) if (e.action_phrase) counts.set(e.action_phrase, (counts.get(e.action_phrase) ?? 0) + 1)
  const table = ACTION_PHRASES.flatMap(({ action, phrases }) => phrases.map(phrase => ({ phrase, action, observed: counts.get(phrase) ?? 0 })))
  fs.writeFileSync(path.join(DIR, "action-normalization.json"), `[\n${table.map(t => JSON.stringify(t)).join(",\n")}\n]\n`)

  console.log(`✅ ${list.length} 件（広報 ${koho.length}）/ 未解決 ${unresolved.length} / 議案の結果を確かめられず ${billsWithoutResult}`)
  unresolved.forEach(u => console.log(`  ${u}`))
}

main()
