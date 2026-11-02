// 広報しんとくの号の題名を読む。scrape-newsletters.ts と検査で共有する。

export type KohoKind = "monthly" | "oshirase"
export type KohoStatus = "pending" | "text" | "no-text"

export interface KohoIssue {
  /** 月号は 2025-05、お知らせ号は 2024-04-oshirase */
  key: string
  kind: KohoKind
  title: string
  /** YYYY-MM-DD。題名に日が無ければ1日 */
  date: string
  year: number
  month: number
  url: string
  /** pending: 未取得 / text: 取り込み済み / no-text: 画像だけで文字なし */
  status: KohoStatus
  pages: number | null
  chars: number | null
  /** 文字がほとんど無いページ */
  blankPages: number[]
}

const toHalf = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
const ERA_BASE: Record<string, number> = { 令和: 2018, 平成: 1988 }

/**
 * 「令和2年（2020年）4月号」「平成22年（2010年）4月号」「令和元年（2019年）5月号」
 * 「令和4年4月15日号」「2025年5月号」「令和8年10月(A4)」を読む。
 */
export function parseKohoDate(rawTitle: string): { year: number; month: number; day: number | null } | null {
  const title = toHalf(rawTitle)
  const era = /(令和|平成)(元|\d+)年(?:[（(]\d{4}年[）)])?\s*(\d{1,2})月(?:(\d{1,2})日)?/.exec(title)
  if (era) {
    const year = ERA_BASE[era[1]] + (era[2] === "元" ? 1 : Number(era[2]))
    return { year, month: Number(era[3]), day: era[4] ? Number(era[4]) : null }
  }
  const western = /(\d{4})年\s*(\d{1,2})月(?:(\d{1,2})日)?/.exec(title)
  if (western) return { year: Number(western[1]), month: Number(western[2]), day: western[3] ? Number(western[3]) : null }
  return null
}

const A4_TAIL = /[\s　]*[（(]?\s*(?:\d{4}年)?\s*[）)]?[\s　]*[（(]?(?:A4|Ａ４)?版?[）)]?$/
/** 号の題名は「名前＋日付＋号＋版」だけでできている。「令和4年8月5日 駅前ビアパーティ」のような案内を除く */
const ISSUE_TITLE = /^(?:広報しんとくお知らせ号|広報お知らせ号|広報しんとく)?[\s　]*(?:(?:令和|平成)(?:元|\d+)年(?:[（(]\d{4}年[）)])?|\d{4}年)[\s　]*\d{1,2}月(?:\d{1,2}日)?号?/

/** 年度ページのリンクのうち、広報の本体（A4版）か */
export function isKohoIssueTitle(rawTitle: string): boolean {
  const title = toHalf(rawTitle).trim()
  if (/A3|Ａ３/.test(title) || parseKohoDate(title) === null) return false
  const m = ISSUE_TITLE.exec(title)
  return m !== null && A4_TAIL.test(title.slice(m[0].length)) && title.slice(m[0].length).replace(A4_TAIL, "") === ""
}

export function kohoKey(kind: KohoKind, year: number, month: number): string {
  const ym = `${year}-${String(month).padStart(2, "0")}`
  return kind === "oshirase" ? `${ym}-oshirase` : ym
}
