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
