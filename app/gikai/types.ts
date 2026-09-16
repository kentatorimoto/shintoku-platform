// /gikai の型と、サーバー描画版・クライアント版で共有する表示の決まり。
// ここに fs を持ち込まないこと（クライアントからも import する）。

export interface GiketsuItem {
  caseNumber:   string
  caseType:     string
  num:          number
  title:        string
  decisionDate: string
  result:       string
}

export interface GiketsuSession {
  pdfUrl:       string
  year:         number
  eraLabel:     string
  sessionLabel: string
  sessionName:  string
  sessionRange: string
  sessionId:    string | null
  items:        GiketsuItem[]
}

export interface FlatItem extends GiketsuItem {
  sessionName:  string
  sessionRange: string
  eraLabel:     string
  year:         number
  pdfUrl:       string
}

export type GikaiLinks = Record<string, string[]>

/** 1ページぶんの件数。サーバーが先に描くのもこの件数。 */
export const PAGE_SIZE = 100

export const ISSUE_LABELS: Record<string, string> = {
  "agri-conservative-target": "農業は年1%成長で町を支え続けられるか？",
  "agri-fewer-farms": "農家戸数が減っても農業総額を維持できるか？",
  "agri-climate": "気候変動で作物転換は必要になるか？",
  "agri-smart": "技術で農業の労働力不足は補えるか？",
  "tourism-satisfaction": "なぜ町民は観光の成果に満足していないのか？",
  "tourism-org-reform": "新得町に新しい観光組織は必要か？",
  "tourism-residents": "なぜ町民は観光の魅力を実感できていないのか？",
  "finance-post-project": "大型事業後の借金をどうコントロールするか？",
  "finance-kpi": "財政の“安全運転ライン”は何か？",
  "finance-slack": "財政の“余力”をどう確保するか？",
}

/**
 * 採決結果の見せ方。**色に意味を負わせず、結果名のテキストで区別する。**
 * 茜は「原案どおり通ったもの」だけに使い、それ以外は墨の濃淡で差をつける。
 */
export function resultStyle(result: string): string {
  switch (result) {
    case "原案可決": return "border-accent/40 text-accent"
    case "修正可決": return "border-lineStrong text-textMain"
    case "否決":     return "border-textMain text-textMain"
    case "継続審査": return "border-line text-textMuted"
    default:         return "border-line text-textMuted"
  }
}

export const RESULT_ORDER = ["原案可決", "修正可決", "否決", "継続審査"]

/** 凡例ドット。図の凡例としての丸は残す（/process のトレース図と同じ扱い）。 */
export const RESULT_DOT: Record<string, string> = {
  "原案可決": "bg-accent", // contrast-ok: 図の凡例の丸。文字は載らない
  "修正可決": "bg-lineStrong",
  "否決":     "bg-textMain",
  "継続審査": "bg-line border border-lineStrong",
}

/** 会期をまたいだ全議案を、年の新しい順に並べて返す。 */
export function flattenItems(sessions: GiketsuSession[]): FlatItem[] {
  return sessions
    .flatMap(s => s.items.map(item => ({
      ...item,
      sessionName:  s.sessionName,
      sessionRange: s.sessionRange,
      eraLabel:     s.eraLabel,
      year:         s.year,
      pdfUrl:       s.pdfUrl,
    })))
    .sort((a, b) => b.year - a.year)
}

/** gikai_links.json を引くキー。 */
export const linkKey = (item: FlatItem) => `${item.eraLabel}-${item.caseType}-${item.num}`
