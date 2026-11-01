// events.json から /process/traces/ekimae の作図データを作る。API は呼ばない。
//
//   npm run kaigiroku:view -- ekimae
//
// 年表は「layer=fact かつ行為が TIMELINE_ACTIONS」を機械で選び、見出しだけ人が付ける。
// 選ばれたのに図に載せないものは EXCLUDED に理由を書く。どちらにも無い event があれば止まる。

import fs from "fs"
import path from "path"
import type { TraceEvent } from "./event-schema"

const ROOT = process.cwd()
const squash = (s: string) => s.replace(/\s+/g, "")
const TIMELINE_ACTIONS = new Set(["構想", "計画", "予算計上", "契約", "着工", "開所", "延期", "白紙", "増額", "指定"])
const CHANGE_ACTIONS = new Set(["延期", "白紙", "増額"])

interface SpeechRow { date: string; speaker: string; role: string; page: number; text: string }
interface MapEntry { sessionKey: string; title: string; start: string; pdfUrl: string }

/** key は引用の書き出し。whole は事業全体の話で、帯を横断して描く */
const TIMELINE: Record<string, { label: string; whole?: boolean; planned?: boolean; direct?: string }> = {
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
  "６月15日オープン": { label: "「とくとく」6/15開所", direct: "開所" },
  "駅前周辺再整備温浴宿泊施設建設工事、建築主体": { label: "温浴宿泊施設の工事契約" },
  "今のところ完成予定が９月": { label: "12月開業の予定", planned: true },
  "開業は来年４月以降": { label: "開業は来年4月以降に", planned: true },
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
  const pagesOf = (key: string) => fs.readFileSync(path.join(ROOT, "content", "kaigiroku", key, "raw.txt"), "utf-8").split("\f")
    .map(p => squash(p.replace(/^[-－ー―]\s*[0-9０-９]+\s*[-－ー―]$/gm, "")))
  const speechesOf = (key: string) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", "kaigiroku", key, "speeches.json"), "utf-8")) as SpeechRow[]

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
    const e = events.find(x => x.source.quote.startsWith(prefix))
    if (!e) throw new Error(`event が無い: ${prefix}`)
    return e
  }
  const citeEvent = (e: TraceEvent) => cite(e.source.session_key, e.source.speech_index, e.source.quote)

  // 年表: 機械で選んだ event が、載せるか除外するかのどちらかに必ず入っていること
  const selected = events.filter(e => e.layer === "fact" && e.action !== null && TIMELINE_ACTIONS.has(e.action))
  const prefixOf = (e: TraceEvent, keys: string[]) => keys.find(k => e.source.quote.startsWith(k))
  const unassigned = selected.filter(e => !prefixOf(e, Object.keys(TIMELINE)) && !prefixOf(e, Object.keys(EXCLUDED)))
  if (unassigned.length > 0) throw new Error(`見出しも除外理由も無い: ${unassigned.map(e => `${e.id} ${e.source.quote}`).join(" / ")}`)

  const points = selected.flatMap((e) => {
    const key = prefixOf(e, Object.keys(TIMELINE))
    if (!key) return []
    const c = TIMELINE[key]
    const calloutText = CALLOUTS[key]
    return [{
      id: e.id, date: e.date, action: e.action as string, label: c.label,
      planned: c.planned ?? e.tense === "予定",
      change: CHANGE_ACTIONS.has(e.action as string),
      whole: c.whole ?? false,
      direct: c.direct ?? null,
      objects: e.objects,
      citation: citeEvent(e),
      reason: calloutText ? {
        text: calloutText,
        certainty: e.causes[0]?.certainty ?? "断定",
        citation: cite(e.source.session_key, e.source.speech_index, calloutText),
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
    points,
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
  console.log(`✅ 条件に当たる ${selected.length} 件 → 年表 ${points.length} 点 / 除外 ${excluded.length} / 理由の吹き出し ${points.filter(p => p.reason).length} / カード ${view.cards.length}`)
  excluded.forEach(e => console.log(`   除外 ${e.id}: ${EXCLUDED[prefixOf(e, Object.keys(EXCLUDED)) ?? ""]}`))
}

main()
