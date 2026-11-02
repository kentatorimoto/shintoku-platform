// 広報の中で、町民の名前が並ぶ欄を見分ける。検索索引から外すためのもので、全文（content/koho）は残す。

const squash = (s: string) => s.replace(/\s+/g, "")

/** 確実に個人の欄と言える語。古い号は縦書きが崩れて「結婚」が「婚結」になる */
const PERSONAL: { reason: string; re: RegExp }[] = [
  { reason: "おくやみ", re: /おくやみ/ },
  { reason: "戸籍の窓口", re: /戸籍の窓口/ },
  { reason: "ご結婚", re: /ご結婚|婚結/ },
  { reason: "赤ちゃんの欄", re: /パパ.{0,12}ママ|あのときの赤ちゃん|あの時の赤ちゃん/ },
]

/** 名前は並ぶが、公表を前提にした欄か判断が分かれるもの。外さずに一覧にして人が判断する */
const NAME_WITH_GROUP = /[○◯●・][一-龥ぁ-んァ-ヶ]{2,7}[（(][^）)]{0,8}(?:会|区|町)[）)]/g
const SUSPECTS: { reason: string; test: (s: string) => boolean }[] = [
  { reason: "名前と町内会の列（寄附者など）", test: s => (s.match(NAME_WITH_GROUP) ?? []).length >= 3 },
  { reason: "順不同・敬称略の名簿", test: s => /順不同|敬称略/.test(s) },
  { reason: "敬老会の名簿", test: s => /敬老会/.test(s) && /歳歳|歳.{0,8}歳.{0,8}歳/.test(s) },
  { reason: "入学・卒業の名前", test: s => /入学おめでとう|卒業おめでとう/.test(s) },
  { reason: "結婚の記号（♡）だけの行", test: s => /[一-龥]{2,5}[♡♥][一-龥]{2,5}/.test(s) },
]

export function personalReason(pageText: string): string | null {
  const s = squash(pageText)
  return PERSONAL.find(p => p.re.test(s))?.reason ?? null
}

export function suspectReason(pageText: string): string | null {
  const s = squash(pageText)
  return SUSPECTS.find(p => p.test(s))?.reason ?? null
}
