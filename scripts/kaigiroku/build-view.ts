// events.json から /process/traces/ekimae の作図データを作る。API は呼ばない。
//
//   npm run kaigiroku:view -- ekimae
//
// 年表は「layer=fact かつ行為が TIMELINE_ACTIONS」を機械で選び、見出しだけ人が付ける。
// 選ばれたのに図に載せないものは EXCLUDED に理由を書く。どちらにも無い event があれば止まる。

import fs from "fs"
import path from "path"
import type { TraceEvent } from "./event-schema"
import { loadKohoIssues } from "./koho-source"
import { corpusPath } from "../lib/corpus"

const ROOT = process.cwd()
const squash = (s: string) => s.replace(/\s+/g, "")
const TIMELINE_ACTIONS = new Set(["構想", "計画", "予算計上", "契約", "着工", "開所", "延期", "白紙", "増額", "指定"])
const CHANGE_ACTIONS = new Set(["延期", "白紙", "増額"])

interface SpeechRow { date: string; speaker: string; role: string; page: number; text: string }
interface MapEntry { sessionKey: string; title: string; start: string; pdfUrl: string }

const ONYOKU_PLAN = "温浴宿泊施設の開業"
const ONYOKU_DONE = "温浴宿泊施設の完成"
const TOKUTOKU_PLAN = "複合施設「とくとく」の開業"
const HIROBA_PLAN = "駅前広場の供用"
const HIROBA_START = "駅前広場の工事開始"
const BUILD_START = "複合施設・温浴宿泊施設の着工"
const BANK_PLAN = "金融機関の営業開始"
const SHITEI_PLAN = "指定管理者"
const PLAN_ORDER = [ONYOKU_PLAN, ONYOKU_DONE, TOKUTOKU_PLAN, HIROBA_PLAN, HIROBA_START, BUILD_START, BANK_PLAN, SHITEI_PLAN]

/** key: 比べるための時期。coarse: 年度や「来年」など粗い言い方で、詳しい予定と比べない */
interface PlanRef { plan: string; target: string; key?: string; coarse?: boolean }

/** key は引用の書き出し。whole は事業全体の話で、帯を横断して描く */
const TIMELINE: Record<string, { label: string; whole?: boolean; planned?: boolean; direct?: string; lanes?: string[]; plans?: PlanRef[] }> = {
  "商工会が実施する駅前再整備調査": { label: "商工会の調査に補助", whole: true },
  "複合施設につきましては、その建設着手": { label: "複合施設「着手まで複数年」", planned: true },
  "駅前周辺再整備に伴いＪＲ北海道": { label: "JR用地の購入費を計上", whole: true },
  "令和５年度以降において": { label: "「令和5年度以降に着工」", whole: true, planned: true },
  "全体で32億円程度": { label: "概算 全体32億円程度", whole: true, direct: "概算32億円" },
  "役場庁舎建設、中継施設建設": { label: "「本格的に着工」の方針", whole: true, planned: true },
  "バス等のロータリー部分": { label: "駅前広場の工事に着手へ", planned: true },
  "契約の目的でありますが、街路事業": { label: "駅前広場の工事契約", direct: "契約" },
  "変更前、１億780万円": { label: "同 契約を667万7,000円増額" },
  "駅前周辺再整備複合施設建設工事": { label: "複合施設の工事契約", direct: "契約" },
  "新年度から温浴宿泊施設": { label: "温浴宿泊施設に着手へ", planned: true },
  "令和９年度に複合施設金融機関": { label: "金融機関部分の増築を計画", planned: true },
  "現時点で全体事業費は約７億円": { label: "全体事業費 約7億円増", whole: true, direct: "約7億円増" },
  "令和７年４月１日から令和12年３月31日": { label: "指定管理者の指定（5年間）", direct: "指定" },
  "6月6日、駅前複合施設工事の安全祈願": { label: "複合施設の工事安全祈願祭", lanes: ["とくとく本体"] },
  "駅前ロータリーは3月1日より供用開始": { label: "駅前ロータリー 3/1 供用開始", lanes: ["駅前広場"] },
  "8月5日、駅前温浴宿泊施設工事の安全祈願": { label: "温浴宿泊施設の工事安全祈願祭" },
  // 予定の告知（発行日に置く）。年表に描くのは予定が変わった点だけで、全告知は「予定の変わり方」に残す
  "駅前周辺再整備スケジュール（現時点での予定）": { label: "広場は令和5年度供用、施設は令和7年度開業の予定", lanes: ["駅前広場", "とくとく本体", "温浴宿泊施設"], planned: true, plans: [
    { plan: HIROBA_PLAN, target: "令和5年度" }, { plan: TOKUTOKU_PLAN, target: "令和7年度" }, { plan: ONYOKU_PLAN, target: "令和7年度" },
  ] },
  "令和7年度開業": { label: "複合施設 令和7年度開業の予定", lanes: ["とくとく本体"], planned: true, plans: [{ plan: TOKUTOKU_PLAN, target: "令和7年度", coarse: true }] },
  "令和8年度開業": { label: "温浴宿泊施設 令和8年度開業の予定", lanes: ["温浴宿泊施設"], planned: true, plans: [{ plan: ONYOKU_PLAN, target: "令和8年度", coarse: true }] },
  "令和８年10月温浴宿泊施設": { label: "温浴宿泊施設 令和8年10月開業の予定", lanes: ["温浴宿泊施設"], planned: true, plans: [{ plan: ONYOKU_PLAN, target: "令和8年10月" }] },
  "令和９年度に金融機関の営業を開始": { label: "金融機関 令和9年度営業開始の予定", lanes: ["金融機関"], planned: true, plans: [{ plan: BANK_PLAN, target: "令和9年度" }] },
  "新・駅前広場": { label: "駅前広場 令和7年4月供用開始の予定", lanes: ["駅前広場"], planned: true, plans: [{ plan: HIROBA_PLAN, target: "令和7年4月" }] },
  "供用（利用）開始予定": { label: "駅前広場 令和7年4月供用開始の予定", lanes: ["駅前広場"], planned: true, plans: [{ plan: HIROBA_PLAN, target: "令和7年4月" }] },
  "令和７年６月複合施設": { label: "複合施設 令和7年6月開業の予定", lanes: ["とくとく本体"], planned: true, plans: [{ plan: TOKUTOKU_PLAN, target: "令和7年6月" }] },
  "複合施設開業予定": { label: "複合施設 令和7年6月開業の予定", lanes: ["とくとく本体"], planned: true, plans: [{ plan: TOKUTOKU_PLAN, target: "令和7年6月" }] },
  "複合施設金融機関建設工事開業予定": { label: "複合施設 令和7年6月開業の予定", lanes: ["とくとく本体"], planned: true, plans: [{ plan: TOKUTOKU_PLAN, target: "令和7年6月" }] },
  "令和５年５月中旬から": { label: "駅前広場の工事 令和5年5月からの予定", lanes: ["駅前広場"], planned: true, plans: [{ plan: HIROBA_START, target: "令和5年5月" }] },
  "複合施設➡︎令和６年": { label: "着工予定 複合施設は令和6年、温浴宿泊施設は令和7年", lanes: ["とくとく本体", "温浴宿泊施設"], planned: true, plans: [{ plan: BUILD_START, target: "複合施設 令和6年・温浴宿泊施設 令和7年" }] },
  "町商工会が出資する「新得タウンマネジメント株式会社」を予": { label: "指定管理者に新得タウンマネジメントの予定", lanes: ["指定管理"], planned: true, plans: [{ plan: SHITEI_PLAN, target: "新得タウンマネジメント" }] },
  "今年は複合施設、来年は宿泊施設": { label: "複合施設は今年〔令和7年〕、宿泊施設は来年〔令和8年〕開業の予定", lanes: ["とくとく本体", "温浴宿泊施設"], planned: true, plans: [
    { plan: ONYOKU_PLAN, target: "来年〔令和8年〕", coarse: true }, { plan: TOKUTOKU_PLAN, target: "今年〔令和7年〕", coarse: true },
  ] },
  "「とくとく」は6月15日にオープン": { label: "「とくとく」6月15日〔令和7年〕オープンと告知", planned: true, lanes: ["とくとく本体"], plans: [{ plan: TOKUTOKU_PLAN, target: "6月15日〔令和7年〕", key: "令和7年6月" }] },
  "6月に駅前の複合施設がオープン": { label: "複合施設 6月〔令和7年〕オープンの回答", lanes: ["とくとく本体"], planned: true, plans: [{ plan: TOKUTOKU_PLAN, target: "6月〔令和7年〕", key: "令和7年6月" }] },
  "できる予算新得駅前地域交流センター": { label: "「とくとく」オープンの予定", lanes: ["とくとく本体"], planned: true, plans: [{ plan: TOKUTOKU_PLAN, target: "令和7年度", coarse: true }] },
  "令和7年６月にオープンを迎えます": { label: "「とくとく」令和7年6月オープンの予定", lanes: ["とくとく本体"], planned: true, plans: [{ plan: TOKUTOKU_PLAN, target: "令和7年6月" }] },
  "令和8年12月開": { label: "温浴宿泊施設 令和8年12月開業の予定", lanes: ["温浴宿泊施設"], planned: true, plans: [{ plan: ONYOKU_PLAN, target: "令和8年12月" }] },
  "今年から工事が始まる予定": { label: "温浴宿泊施設 今年〔令和7年〕から工事の予定", lanes: ["温浴宿泊施設"], planned: true, plans: [{ plan: BUILD_START, target: "温浴宿泊施設 今年〔令和7年〕" }] },
  "令和8年10月に完成を予定": { label: "温浴宿泊施設 令和8年10月完成の予定", lanes: ["温浴宿泊施設"], planned: true, plans: [{ plan: ONYOKU_DONE, target: "令和8年10月" }] },
  "12月開業予定の温浴宿泊施設": { label: "温浴宿泊施設 12月〔令和8年〕開業の予定", lanes: ["温浴宿泊施設"], planned: true, plans: [{ plan: ONYOKU_PLAN, target: "12月〔令和8年〕", key: "令和8年12月" }] },
  "令和8年度に温浴宿泊施設が開業": { label: "温浴宿泊施設 令和8年度開業の予定", lanes: ["温浴宿泊施設"], planned: true, plans: [{ plan: ONYOKU_PLAN, target: "令和8年度", coarse: true }] },
  "令和８年12月の開業に向け": { label: "開業の延期をお知らせ", lanes: ["温浴宿泊施設"], plans: [{ plan: ONYOKU_PLAN, target: "令和9年4月" }] },
  "町営浴場の閉館も令和９年３月末まで延期": { label: "町営浴場の閉館を令和9年3月末まで延期", lanes: ["町営浴場"], planned: true },
  "令和9年4月開業予定の温浴宿泊施設": { label: "温浴宿泊施設 令和9年4月開業の予定", lanes: ["温浴宿泊施設"], planned: true, plans: [{ plan: ONYOKU_PLAN, target: "令和9年4月" }] },
  "温浴宿泊施設は令和9年4月にオープン": { label: "令和9年4月オープンと告知", lanes: ["温浴宿泊施設"], planned: true, plans: [{ plan: ONYOKU_PLAN, target: "令和9年4月" }] },
  "６月15日オープン": { label: "「とくとく」6/15開所", direct: "開所" },
  "駅前周辺再整備温浴宿泊施設建設工事、建築主体": { label: "温浴宿泊施設の工事契約" },
  "今のところ完成予定が９月": { label: "12月〔令和8年〕開業の予定", planned: true, plans: [{ plan: ONYOKU_PLAN, target: "12月〔令和8年〕", key: "令和8年12月" }, { plan: ONYOKU_DONE, target: "9月〔令和8年〕", key: "令和8年9月" }] },
  "開業は来年４月以降": { label: "開業は来年〔令和9年〕4月以降に", planned: true, plans: [{ plan: ONYOKU_PLAN, target: "来年〔令和9年〕4月以降", key: "令和9年4月" }] },
  "いったん白紙": { label: "金融機関の増設 いったん白紙", direct: "白紙" },
  "既存の町営浴場の営業を延長": { label: "町営浴場の営業を延長", planned: true },
  "インフレスライドを適用": { label: "工事費を増額（補正予算）" },
  "変更前、10億4,390万円": { label: "契約を1億2,663万9,150円増額" },
}
const EXCLUDED: Record<string, string> = {
  "平成28年５月からは": "商工会の事業部新設で、語の一致により着工に分類されたもの",
  "本年５月24日に報告": "商工会の報告で、予算計上ではない",
  "地域戦略室に専任の補佐": "職員配置で、構想そのものではない",
  "金融機関だとか、観光協会": "補助対象の説明で、予算計上ではない",
  "そのうちの35億円くらい": "複数事業の財源の説明で、対象を特定できない",
  "前年度対比42.5パーセント増": "町全体の一般会計予算で、この事業の額ではない",
  "複合施設が８億2,800万円": "全体32億円と同じ説明の内訳",
  "駅前広場・ロータリー部分は令和5年度から工事": "広報: ロータリーの供用開始と同じ内容",
  "関係機関協議調整": "広報: 同じ表のスケジュールの見出しと同じ内容",
  "４〜６月": "広報: スケジュール表の文字が連なり、読めない",
  "複合施設複合施設N開業": "広報: 同じ紙面の「令和７年６月複合施設」と同じ内容",
  "オープン１周年": "広報: 記念行事の案内で、開所の日ではない",
  "町営浴場は、温浴宿泊施設の開業延期": "広報: 同じ号の閉館延期のお知らせと同じ内容",
  "なお、現在の町営浴場を令和８年度に解体後": "広報: 金融機関の営業開始の予定と同じ文",
  "通路の場所は随時変わります": "広報: 同じ紙面の着工予定（複合施設は令和6年…）と同じ告知",
  "一切入れません一切": "広報: 同じ紙面の着工予定（複合施設は令和6年…）と同じ告知",
  "設計を含む": "広報: スケジュール表と費用の文字が連なり、予定として読めない",
}
/** 町が示した理由。text は原文の抜き出し（検査で本文との一致を確かめる） */
const CALLOUTS: Record<string, string> = {
  "変更前、１億780万円": "地中電線管が想定より浅い位置で確認されたことにより",
  "現時点で全体事業費は約７億円": "物価高騰の影響を受け",
  "開業は来年４月以降": "中東情勢悪化の影響を受けまして、駅前温浴宿泊施設の建設が大幅に遅れております",
  "いったん白紙": "コスト増、町民の利便性などを再度考慮し",
  "インフレスライドを適用": "中東情勢の影響を受け、資材単価および労務単価の上昇によりインフレスライドを適用",
}
const CARDS: { topic: string; session: string; q: [number, string]; a: [number, string] }[] = [
  { topic: "再整備の範囲", session: "h25-2013-03-regular-1",
    q: [192, "構想だけでももう少し広げた考えを持っていただけないかお伺いしたいと思います"],
    a: [194, "まずは駅前広場の町有地の範囲内での構想を考えていこうというものであります"] },
  { topic: "ロータリーの通行", session: "r4-2022-03-regular-1",
    q: [182, "ロータリーでの逆走車防止の解決になるのかが疑問であり"],
    a: [184, "ご質問にあるロータリー全体を交互通行にという要望には応えることができなかったものであります"] },
  { topic: "ホテルを町が建てる意義", session: "r6-2024-12-regular-4",
    q: [132, "公共施設としてビジネスホテルを建設する意義をあらためてお伺いいたします"],
    a: [134, "ビジネスホテルという選択肢が増えることで、人を呼び込み、新たな消費を創出し"] },
]

/** 表の中の数字は文字の並びが崩れるので、本文にある形をそのまま引く */
const COST_QUOTES = { y2021: "設計費や工事費全体で“約３２億円”を見込んでいます", y2022: "３２億５，８００万円", y2024: "合計３６億６，８７０万円" }

function main() {
  const theme = process.argv[2]
  const dir = path.join(ROOT, "content", "traces")
  const events = JSON.parse(fs.readFileSync(path.join(dir, `${theme}.events.json`), "utf-8")) as TraceEvent[]
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "kaigiroku", "session-map.json"), "utf-8")) as MapEntry[]
  const bySession = new Map(map.map(m => [m.sessionKey, m]))

  const meeting = (key: string) => {
    const e = bySession.get(key)
    if (!e) throw new Error(`対応表に無い: ${key}`)
    const y = Number(e.start.slice(0, 4))
    const era = e.start >= "2019-05-01" ? `令和${y - 2018 === 1 ? "元" : y - 2018}年` : `平成${y - 1988}年`
    return `${era} ${e.title.replace(/[（(].*$/, "").replace(/会議録$/, "").trim()}`
  }
  const pagesOf = (key: string) => fs.readFileSync(corpusPath("kaigiroku", key, "raw.txt"), "utf-8").split("\f")
    .map(p => squash(p.replace(/^[-－ー―]\s*[0-9０-９]+\s*[-－ー―]$/gm, "")))
  const speechesOf = (key: string) => JSON.parse(fs.readFileSync(corpusPath("kaigiroku", key, "speeches.json"), "utf-8")) as SpeechRow[]

  /** 発言の中の語句を、会議・日付・発言者・PDFページ付きの出典にする */
  function cite(key: string, index: number, quote: string) {
    const s = speechesOf(key)[index]
    if (!s || !squash(s.text).includes(squash(quote))) throw new Error(`本文に無い: ${key}#${index} ${quote}`)
    const pages = pagesOf(key)
    const q = squash(quote)
    const one = pages.findIndex((p, i) => i + 1 >= s.page && p.includes(q))
    const page = (one >= 0 ? one : pages.findIndex((p, i) => i + 1 >= s.page && `${p}${pages[i + 1] ?? ""}`.includes(q))) + 1
    return {
      meeting: meeting(key), sessionKey: key, speechIndex: index, date: s.date, speaker: s.speaker, role: s.role,
      page, url: `${bySession.get(key)?.pdfUrl}#page=${page}`, quote,
    }
  }
  const find = (prefix: string) => {
    const e = events.find(x => x.source_type === "kaigiroku" && x.source.quote.startsWith(prefix))
    if (!e) throw new Error(`event が無い: ${prefix}`)
    return e
  }
  const citeEvent = (e: TraceEvent) => {
    if (e.source_type === "koho") {
      return {
        kind: "koho", meeting: e.source.issue ?? "", sessionKey: null, speechIndex: null, date: e.date,
        speaker: e.actor.name, role: e.actor.role, page: e.source.page, url: e.source.url, quote: e.source.quote,
      }
    }
    return cite(e.source.session_key ?? "", e.source.speech_index ?? -1, e.source.quote)
  }

  // 年表: 機械で選んだ event が、載せるか除外するかのどちらかに必ず入っていること
  // 広報は記事に日付が書かれたものだけ（発行日しかない記事は、出来事の日を示せない）
  // 予定の告知は日付が無くても載せる
  const prefixOf = (e: TraceEvent, keys: string[]) => keys.find(k => e.source_type === "koho" ? e.source.quote.includes(k) : e.source.quote.startsWith(k))
  const selected = events.filter(e => e.layer === "fact" && e.action !== null && TIMELINE_ACTIONS.has(e.action)
    && (e.source_type === "kaigiroku" || e.stated_date !== null || e.tense === "予定" || prefixOf(e, Object.keys(TIMELINE)) !== undefined))
  const unassigned = selected.filter(e => !prefixOf(e, Object.keys(TIMELINE)) && !prefixOf(e, Object.keys(EXCLUDED)))
  if (unassigned.length > 0) throw new Error(`見出しも除外理由も無い: ${unassigned.map(e => `${e.id} ${e.source.quote}`).join(" / ")}`)

  const seenInIssue = new Set<string>()
  const points = selected.flatMap((e) => {
    const key = prefixOf(e, Object.keys(EXCLUDED)) ? undefined : prefixOf(e, Object.keys(TIMELINE))
    if (!key) return []
    // 同じ紙面の表と文から同じ予定が二度取れることがある
    if (seenInIssue.has(`${e.date}#${key}`)) return []
    seenInIssue.add(`${e.date}#${key}`)
    const c = TIMELINE[key]
    const calloutText = CALLOUTS[key]
    return [{
      id: e.id, sourceType: e.source_type,
      // 広報の、終わった出来事は記事に書かれた日に置く。予定の告知は発行日に置く
      date: e.source_type === "koho" && !(c.planned ?? e.tense === "予定") && /^\d{4}-\d{2}-\d{2}$/.test(e.stated_date ?? "") ? e.stated_date as string : e.date, action: e.action as string, label: c.label,
      planned: c.planned ?? e.tense === "予定",
      change: CHANGE_ACTIONS.has(e.action as string),
      whole: c.whole ?? false,
      direct: c.direct ?? null,
      objects: c.lanes ?? e.objects,
      plans: c.plans ?? [],
      citation: citeEvent(e),
      reason: calloutText ? {
        text: calloutText,
        certainty: e.causes[0]?.certainty ?? "断定",
        citation: cite(e.source.session_key ?? "", e.source.speech_index ?? -1, calloutText),
      } : null,
    }]
  }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  // 年表に載る出来事が無い期間の、年ごとの発言件数（抜粋の件数）
  const excerptRows = JSON.parse(fs.readFileSync(path.join(dir, `${theme}.excerpts.json`), "utf-8")) as { date: string }[]
  const quietYears = [2010, 2011, 2012, 2013, 2014, 2015, 2016].map(year => ({
    year, count: excerptRows.filter(e => e.date.startsWith(String(year))).length,
  }))
  const pointInQuietYears = points.find(p => p.date < "2017")
  if (pointInQuietYears) throw new Error(`縮めた期間に点がある: ${pointInQuietYears.date} ${pointInQuietYears.label}`)

  // 全告知は一覧に残し、年表には予定が変わった点だけを置く
  const planChanges = PLAN_ORDER.map(name => ({
    name,
    rows: points.flatMap(p => p.plans.filter(r => r.plan === name).map(r => ({
      date: p.date, target: r.target, moved: p.action === "延期", sourceType: p.sourceType, citation: p.citation,
    }))),
  })).filter(g => g.rows.length > 0)

  const lastKey = new Map<string, string>()
  const drawn = points.filter((p) => {
    if (!p.planned || p.plans.length === 0) {
      p.plans.forEach(r => lastKey.set(r.plan, r.key ?? r.target))
      return true
    }
    let changed = false
    for (const r of p.plans) {
      const key = r.key ?? r.target
      const prev = lastKey.get(r.plan)
      if (prev === undefined) changed = true
      else if (!r.coarse && prev !== key) changed = true
      if (prev === undefined || !r.coarse) lastKey.set(r.plan, key)
    }
    return changed
  })
  const kohoIssues = loadKohoIssues()
  /** 広報の本文から語句を引く。本文に無ければ止める */
  const kohoCite = (key: string, page: number, quote: string) => {
    const issue = kohoIssues.find(i => i.key === key)
    const body = issue?.pages.find(p => p.page === page)?.text ?? ""
    if (!issue || !squash(body).includes(squash(quote))) throw new Error(`広報の本文に無い: ${key} p.${page} ${quote}`)
    return {
      kind: "koho", meeting: issue.label, sessionKey: null, speechIndex: null, date: issue.date,
      speaker: "町（広報しんとく）", role: "広報", page, url: `${issue.url}#page=${page}`, quote,
    }
  }
  const delayReasons = [
    { subject: "町（広報しんとく）の説明", citation: kohoCite("2026-07", 18, "中東情勢の影響により建築資材の入荷が遅れることが確定したため、開業を令和９年４月に延期することになりました") },
    { subject: "会議録の答弁", citation: cite("r8-2026-06-regular-2", 9, "中東情勢悪化の影響を受けまして、駅前温浴宿泊施設の建設が大幅に遅れております") },
  ]

  // 町が示した概算の総額。範囲が同じとは言えないので、足したり比べたりせず時点と範囲を添えて並べる
  const costStatements = [
    { amount: "約32億円", when: "2021年6月号", scope: "概略設計の前の想定。設計費や工事費全体で、内訳の記載なし", citation: kohoCite("2021-06", 8, COST_QUOTES.y2021) },
    { amount: "32億5,800万円", when: "2022年8月号", scope: "令和3年度の概略設計で算出。駅前広場（設計を含む）・複合施設・温浴宿泊施設・全体の実施設計・全体の外構", citation: kohoCite("2022-08", 13, COST_QUOTES.y2022) },
    { amount: "36億6,870万円", when: "2024年4月号", scope: "令和2〜9年度の概算。2022年8月号と同じ5区分", citation: kohoCite("2024-04", 19, COST_QUOTES.y2024) },
  ]

  const view = {
    title: "駅前の15年",
    subtitle: "2010年の一般質問から2026年まで",
    contrast: [
      { year: "2011", citation: cite("h23-2011-03-regular-1", 303, "構想というものは今持ち合わせていない") },
      { year: "2026", citation: citeEvent(find("いったん白紙")) },
    ],
    stats: {
      years: { value: "15年", note: "2011年の答弁から2026年の報告まで" },
      total: { value: "約32億円", note: "概算事業費（2022年3月の説明）", citation: citeEvent(find("全体で32億円程度")) },
      increase: { value: "約7億円", note: "増額（2024年12月、当初計画との比較）", citation: citeEvent(find("現時点で全体事業費は約７億円")) },
    },
    mayors: [
      { name: "浜田正利 町長", until: "2025-06", citation: cite("r7-2025-06-regular-2", speechesOf("r7-2025-06-regular-2").findIndex(s => s.role === "町長"), "") },
      { name: "湯浅真希 町長", from: "2025-08", citation: cite("r7-2025-08-rinji-2", speechesOf("r7-2025-08-rinji-2").findIndex(s => s.role === "町長"), "") },
    ],
    quietYears,
    points: drawn,
    planChanges,
    delayReasons,
    costStatements,
    cost: [
      { label: "事業全体", base: 32, baseLabel: "約32億円", plus: 7, plusLabel: "約7億円増",
        citations: [citeEvent(find("全体で32億円程度")), citeEvent(find("現時点で全体事業費は約７億円"))] },
      { label: "温浴宿泊施設（建築主体の契約）", base: 10.439, baseLabel: "10億4,390万円", plus: 1.2663915, plusLabel: "1億2,663万9,150円増",
        citations: [citeEvent(find("変更前、10億4,390万円"))] },
    ],
    cards: CARDS.map(c => ({
      topic: c.topic,
      question: cite(c.session, c.q[0], c.q[1]),
      answer: cite(c.session, c.a[0], c.a[1]),
    })),
  }
  fs.writeFileSync(path.join(dir, `${theme}.view.json`), JSON.stringify(view, null, 2) + "\n")

  const excluded = selected.filter(e => prefixOf(e, Object.keys(EXCLUDED)))
  console.log(`✅ 条件に当たる ${selected.length} 件 → 年表 ${drawn.length} 点（広報 ${drawn.filter(p => p.sourceType === "koho").length}）／告知 ${points.length} 件 / 除外 ${excluded.length} / 理由の吹き出し ${points.filter(p => p.reason).length} / カード ${view.cards.length}`)
  excluded.forEach(e => console.log(`   除外 ${e.id}: ${EXCLUDED[prefixOf(e, Object.keys(EXCLUDED)) ?? ""]}`))
}

main()
