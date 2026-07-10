// コンテンツ正典スキーマの共通型・バリデータ・シリアライザ
// 仕様は docs/content-schema.md v1.2 が正。実装で迷ったらそちらを見る。
//
// UI コード（app/gikai/sessions/[id]/[partIndex]/page.tsx）もここから型を import する。
// fs / yaml 等の Node 専用モジュールを持ち込まないこと（Next のバンドルに入る）。

// ── 型定義 ──────────────────────────────────────────────────────────────────

export interface QnaItem {
  speaker_name:       string
  speaker_role:       string
  topic_title:        string
  topic_tags:         string[]
  question_points:    string[]
  answer_summary:     string
  answer_points:      string[]
  conclusion:         string
  continuing_issues:  string[]
  mentioned_entities: string[]
  mentioned_numbers:  string[]
}

export interface QnaData {
  session_id:   string
  part_index:   number
  session_date: string
  part_type?:   string
  source_url:   string
  items:        QnaItem[]
  /** ファイルごとに3つの異なるスキーマが混在するため型付けしない。
   *  MD では frontmatter の `_passthrough.topics_index` に無加工で退避・復元する（スキーマ §3）。 */
  topics_index?: unknown
}

export interface BillQuestion {
  questioner: string
  content:    string
  answer:     string
}

export interface BillItem {
  bill_number:           string
  bill_title:            string
  bill_tags:             string[]
  summary:               string
  proposer:              string
  questions:             BillQuestion[]
  result:                string
  result_detail:         string
  referred_to_committee: boolean
}

export interface CommitteeReferral {
  bill_numbers: string[]
  committee:    string
  note:         string
}

export interface AdministrativeReport {
  title:   string
  content: string
}

export interface HonkaigiData {
  session_id:            string
  part_index:            number
  session_date:          string
  part_type:             "honkaigi"
  source_url:            string
  items:                 BillItem[]
  committee_referrals:   CommitteeReferral[]
  administrative_reports?: AdministrativeReport[]
}

export type PartData = QnaData | HonkaigiData

export function isHonkaigi(data: PartData): data is HonkaigiData {
  return data.part_type === "honkaigi"
}

export interface Part {
  label:      string
  youtube?:   string
  pdf?:       string
  slidesDir?: string
}

export interface Summary {
  issues:      string
  conflicts:   string
  nextActions: string
}

export interface GikaiSession {
  id:              string
  officialTitle:   string
  narrativeTitle?: string
  date:            string
  /** 並び順の基準日（通常は会期初日）。省略時は date にフォールバック。
   *  gikai_sessions.json には出力しない — 並び順の決定にのみ使う（スキーマ §2.1）。 */
  sortDate?:       string
  summary?:        Summary
  tags:            string[]
  parts:           Part[]
}

// ── タグ規則（スキーマ §10）─────────────────────────────────────────────────

export const MEETING_TAGS = ["定例会", "臨時会", "特別委員会"] as const
export const BILL_TAGS    = ["当初予算", "補正予算", "決算"] as const
export const ATTR_TAGS    = ["争点あり", "修正可決あり"] as const
export const KNOWN_THEME_TAGS = [
  "インフラ", "農業", "観光", "宿泊税", "教育", "文化", "子育て",
  "財政", "医療", "物価高騰対策", "総合計画", "エネルギー", "人口政策",
] as const

const MAX_THEME_TAGS = 6

export interface TagValidation {
  errors:   string[]
  warnings: string[]
}

/**
 * 会議種別ちょうど1・議案種別0か1・テーマ最大6を検証する。
 * 既知一覧にないテーマタグは警告に留める（将来の追加を塞がないため）。
 */
export function validateTags(tags: string[]): TagValidation {
  const errors: string[] = []
  const warnings: string[] = []

  const meeting = tags.filter(t => (MEETING_TAGS as readonly string[]).includes(t))
  const bill    = tags.filter(t => (BILL_TAGS as readonly string[]).includes(t))
  const themes  = tags.filter(t =>
    ![...MEETING_TAGS, ...BILL_TAGS, ...ATTR_TAGS].includes(t as never)
  )

  if (meeting.length !== 1) {
    errors.push(
      `会議種別タグ（${MEETING_TAGS.join("/")}）はちょうど1つ必要です。` +
      `${meeting.length}個見つかりました: [${meeting.join(", ")}]`
    )
  }
  if (bill.length > 1) {
    errors.push(
      `議案種別タグ（${BILL_TAGS.join("/")}）は最大1つです。` +
      `${bill.length}個見つかりました: [${bill.join(", ")}]`
    )
  }
  if (themes.length > MAX_THEME_TAGS) {
    errors.push(
      `テーマタグは最大${MAX_THEME_TAGS}個です。` +
      `${themes.length}個見つかりました: [${themes.join(", ")}]`
    )
  }

  const duplicates = tags.filter((t, i) => tags.indexOf(t) !== i)
  if (duplicates.length > 0) {
    errors.push(`タグが重複しています: [${[...new Set(duplicates)].join(", ")}]`)
  }

  for (const t of themes) {
    if (!(KNOWN_THEME_TAGS as readonly string[]).includes(t)) {
      warnings.push(`未知のテーマタグ: 「${t}」`)
    }
  }

  return { errors, warnings }
}

// ── JSON正規化シリアライザ（スキーマ §6-6）──────────────────────────────────

// キー順はスキーマ §6-6 の表と一致させること。
const KEY_ORDER: Record<string, readonly string[]> = {
  GikaiSession:         ["id", "officialTitle", "narrativeTitle", "date", "summary", "parts", "tags"],
  Part:                 ["label", "youtube", "pdf", "slidesDir"],
  Summary:              ["issues", "conflicts", "nextActions"],
  QnaData:              ["session_id", "part_index", "session_date", "source_url", "items", "topics_index"],
  HonkaigiData:         ["session_id", "part_index", "session_date", "part_type", "source_url", "items",
                         "committee_referrals", "administrative_reports"],
  QnaItem:              ["speaker_name", "speaker_role", "topic_title", "topic_tags", "question_points",
                         "answer_summary", "answer_points", "conclusion", "continuing_issues",
                         "mentioned_entities", "mentioned_numbers"],
  BillItem:             ["bill_number", "bill_title", "bill_tags", "summary", "proposer", "questions",
                         "result", "result_detail", "referred_to_committee"],
  BillQuestion:         ["questioner", "content", "answer"],
  CommitteeReferral:    ["bill_numbers", "committee", "note"],
  AdministrativeReport: ["title", "content"],
}

type ShapeName = keyof typeof KEY_ORDER

/** `value` のキーを `shape` の定義順に並べ替えた新しいオブジェクトを返す。undefined のキーは落とす。 */
export function orderKeys<T extends object>(value: T, shape: ShapeName): T {
  const order = KEY_ORDER[shape]
  const out: Record<string, unknown> = {}
  for (const key of order) {
    const v = (value as Record<string, unknown>)[key]
    if (v !== undefined) out[key] = v
  }
  // 定義漏れの検出。sortDate は意図的に出力しないので除外する。
  for (const key of Object.keys(value)) {
    if (!order.includes(key) && key !== "sortDate") {
      throw new Error(`stableStringify: ${shape} に未定義のキー「${key}」があります。KEY_ORDER を更新してください。`)
    }
  }
  return out as T
}

/**
 * キー順固定・インデント2・末尾改行つきの決定的なJSON文字列を返す。
 * 生成される public/data/*.json はすべてこれを通す。
 */
export function stableStringify(data: unknown): string {
  return JSON.stringify(data, null, 2) + "\n"
}
