// 広報の中で、町民の名前が並ぶ欄を見分ける。該当ページは raw.txt でも本文を目印に置き換え、
// 検索索引にも入れない。名前をリポジトリに残さないため。ページ番号はずらさない。

const squash = (s: string) => s.replace(/\s+/g, "")

/** 「○氏名（○○会）」が3つ以上並ぶ行。寄附者の欄の形 */
const NAME_WITH_GROUP_LIST = /(?:[○◯●・][一-龥ぁ-んァ-ヶ]{2,7}[（(][^）)]{0,8}(?:会|区|町)[）)].*){3}/

/** 確実に個人の欄と言える語。古い号は縦書きが崩れて「結婚」が「婚結」になる */
const PERSONAL: { reason: string; re: RegExp }[] = [
  { reason: "おくやみ", re: /おくやみ/ },
  { reason: "戸籍の窓口", re: /戸籍の窓口/ },
  { reason: "ご結婚", re: /ご結婚|婚結/ },
  { reason: "赤ちゃんの欄", re: /パパ.{0,12}ママ|あのときの赤ちゃん|あの時の赤ちゃん/ },
  { reason: "敬老会の名簿", re: /長寿番付|長者番付|敬老会.*(?:歳歳|歳.{0,8}歳.{0,8}歳)/ },
  { reason: "入学・卒業の名前", re: /入学おめでとう|卒業おめでとう/ },
  { reason: "寄附者の名前と町内会の列", re: NAME_WITH_GROUP_LIST },
]

/** 公表を前提にした欄か判断が分かれるもの。本文に残し、一覧にして人が判断する */
const SUSPECTS: { reason: string; test: (s: string) => boolean }[] = [
  { reason: "順不同・敬称略の名簿", test: s => /順不同|敬称略/.test(s) },
  { reason: "結婚の記号（♡）だけの行", test: s => /[一-龥]{2,5}[♡♥][一-龥]{2,5}/.test(s) },
]

const MARKER = /^〔個人の欄のため除外：(.+)〕$/

export const personalMarker = (reason: string) => `〔個人の欄のため除外：${reason}〕`

/** 目印に置き換え済みのページなら理由を返す */
export function maskedReason(pageText: string): string | null {
  return MARKER.exec(pageText.trim())?.[1] ?? null
}

export function personalReason(pageText: string): string | null {
  const s = squash(pageText)
  return PERSONAL.find(p => p.re.test(s))?.reason ?? null
}

export function suspectReason(pageText: string): string | null {
  const s = squash(pageText)
  return SUSPECTS.find(p => p.test(s))?.reason ?? null
}

// ── 索引から外す文：児童生徒の名前 ───────────────────────────────────────────
// 全文（corpus）には残し、公開の検索索引からだけ外す。名前の判定は規則なので取りこぼしはある。
//   1. 学校・学年と名前の並び
//   2. 子ども議会の児童生徒の名簿にある氏名（名簿は corpus の names/child-assembly.txt。公開側には置かない）
//   3. 「〇〇くん」「〇〇ちゃん」の形の名前

const SCHOOL = "(?:[一-龥ぁ-んァ-ヶ]{0,6}(?:小中学校|小学校|中学校|高等学校|高校|義務教育学校|幼稚園|保育所|保育園|こども園)|新得小|新得中|屈足小|屈足中|屈足南小|新小|新中|屈小|屈中)"
const GRADE = "(?:[0-9０-９一二三四五六]年生|[小中高][0-9０-９一二三四五六](?:年生?)?)"
const NAME = "([一-龥々ヶ][一-龥々ぁ-んァ-ヶー]{0,3} ?[一-龥々ぁ-んァ-ヶー]{1,4})(?:さん|くん|君|ちゃん)"
const SEP = "[ 、,・のは]{0,3}"
const SCHOOL_NAME = new RegExp([
  `${SCHOOL}${SEP}(?:(?:${GRADE}|[0-9０-９一二三四五六])${SEP})?${NAME}`,
  `${GRADE}${SEP}${NAME}`,
  `${NAME} ?[（(][^）)]{0,14}(?:${SCHOOL}|${GRADE}|[0-9０-９一二三四五六]年)`,
].join("|"), "g")
/** 名前に見えて名前でないもの（「吹奏楽部の皆さん」など） */
const NOT_NAME = /(皆|みな|生徒|児童|先生|選手|部員|全員|方々|たち|達|会員|園児)$/
/** 「くんで」（汲んで）は名前ではない */
const KUN_CHAN = /([一-龥々ヶ][一-龥々ぁ-んァ-ヶー]{0,3} ?[一-龥々ぁ-んァ-ヶー]{0,4})(?:くん|ちゃん)(?![でだ])/g
/** 「赤ちゃん」「お兄ちゃん」「おじいちゃん」など */
const NOT_KUN_CHAN = /(赤|兄|姉|爺|婆|坊|父|母|皆|じい|じぃ|ばあ|ばぁ|ばー|じー|あか|にい|ねえ|かあ|とう|あま|しんと)$/
/** 文の区切りが遠いときに、名前の前後を外す幅の上限 */
const SPAN_CHARS = 60

/** re に当たった名前を含む文を外す。removed は外した文の数 */
function stripSentences(text: string, re: RegExp, notName: RegExp | null): { text: string; removed: number } {
  const spans: [number, number][] = []
  for (const m of text.matchAll(re)) {
    const name = m.slice(1).find(Boolean) ?? m[0]
    if (notName?.test(name.replace(/ /g, ""))) continue
    const start = m.index ?? 0
    const end = start + m[0].length
    const head = text.slice(Math.max(0, start - SPAN_CHARS), start)
    const cut = Math.max(head.lastIndexOf("。"), head.lastIndexOf("！"), head.lastIndexOf("？"))
    const from = cut >= 0 ? start - head.length + cut + 1 : start - head.length
    const tail = text.slice(end, end + SPAN_CHARS)
    const stop = tail.search(/[。！？]/)
    const to = stop >= 0 ? end + stop + 1 : end + tail.length
    const last = spans[spans.length - 1]
    if (last && from <= last[1]) last[1] = Math.max(last[1], to)
    else spans.push([from, to])
  }
  if (spans.length === 0) return { text, removed: 0 }
  let out = ""
  let pos = 0
  for (const [from, to] of spans) {
    out += text.slice(pos, from) + " "
    pos = to
  }
  out += text.slice(pos)
  return { text: out.replace(/ {2,}/g, " ").trim(), removed: spans.length }
}

/** 名簿の氏名を1つの正規表現にする。名簿が空なら null */
export function rosterPattern(names: string[]): RegExp | null {
  const list = names.map(n => n.trim()).filter(n => n.length >= 2).sort((a, b) => b.length - a.length)
  return list.length > 0 ? new RegExp(list.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g") : null
}

export interface MinorRemoved { school: number; roster: number; kunChan: number }

/** 児童生徒の名前を含む文を外す。removed は外した文の数（1→2→3 の順に外し、先に外した文は数え直さない） */
export function stripMinorNames(text: string, roster: RegExp | null): { text: string; removed: MinorRemoved } {
  const a = stripSentences(text, SCHOOL_NAME, NOT_NAME)
  const b = roster ? stripSentences(a.text, roster, null) : { text: a.text, removed: 0 }
  const c = stripSentences(b.text, KUN_CHAN, NOT_KUN_CHAN)
  return { text: c.text, removed: { school: a.removed, roster: b.removed, kunChan: c.removed } }
}
