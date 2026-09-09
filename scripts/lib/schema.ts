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

// ── 郷土資料（スキーマ §12）─────────────────────────────────────────────────
//
// 権利ガードレール（docs/claude-code-archive-shiseki.md）:
//   公開するのは「所在地・年代・2〜3文の概要・原本ページ番号」まで。
//   OCR全文と図版は public/ に出さない。ここの型に本文フィールドを足さないこと。

export const SHISEKI_CONFIDENCES = ["confirmed", "check"] as const
export type ShisekiConfidence = (typeof SHISEKI_CONFIDENCES)[number]

/** 公開する書誌。出典表記に必要なものだけを持つ（編纂者一覧などは公開しない）。 */
export interface BookMeta {
  id:            string
  title:         string
  publisher:     string
  /** 出典表記に使う発行年（西暦4桁） */
  year:          string
  /** `p.{page}` を含むテンプレート。UI がページ番号を差し込む */
  citation:      string
  citation_note: string
}

/** 公開する史跡1件。**本文は持たない。** */
export interface ShisekiItem {
  id:          string
  title:       string
  order:       number
  page_start:  number
  page_end?:   number
  confidence:  ShisekiConfidence
  reviewed:    boolean
  location?:   string
  era?:        string
  /** 議会記録との接続キー（完全一致でのみ使う） */
  entities:    string[]
  /** 公開する2〜3文の概要。未作成なら省略 */
  summary?:    string
}

export interface ShisekiData {
  book:  BookMeta
  items: ShisekiItem[]
}

/** 概要の長さの目安。超過は警告（読者が1画面で読み切れる量に保つ）。 */
const SUMMARY_MAX_CHARS = 200

export interface ArchiveValidation {
  errors:   string[]
  warnings: string[]
}

const BOOK_REQUIRED = ["id", "title", "publisher", "publication_date", "citation", "citation_note"] as const

/** book.yaml を検証する。 */
export function validateBook(data: unknown, bookId: string): ArchiveValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (typeof data !== "object" || data === null) {
    return { errors: ["book.yaml がオブジェクトではありません"], warnings }
  }
  const d = data as Record<string, unknown>

  for (const key of BOOK_REQUIRED) {
    if (typeof d[key] !== "string" || d[key] === "") errors.push(`book.yaml に \`${key}\` が必要です`)
  }
  if (d.id !== bookId) {
    errors.push(`book.yaml の id は "${bookId}"（ディレクトリ名に対応）です: "${String(d.id)}"`)
  }
  if (typeof d.citation === "string" && !d.citation.includes("{page}")) {
    errors.push("book.yaml の `citation` には `p.{page}` の差し込み位置が必要です")
  }

  // 権利ガードレール: 公開範囲の宣言が落ちていないか
  const rights = d.rights as Record<string, unknown> | undefined
  if (!rights) {
    errors.push("book.yaml に `rights` が必要です")
  } else {
    if (rights.publication_scope !== "summary_only") {
      errors.push(`book.yaml の rights.publication_scope は "summary_only" です: "${String(rights.publication_scope)}"`)
    }
    if (rights.full_text_public !== false) errors.push("book.yaml の rights.full_text_public は false です")
    if (rights.figures_public !== false) errors.push("book.yaml の rights.figures_public は false です")
  }

  return { errors, warnings }
}

/** 史跡MDの frontmatter を検証する。`reviewed: true` なら概要が要る。 */
export function validateShiseki(fm: unknown, file: string, bookId: string): ArchiveValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (typeof fm !== "object" || fm === null) {
    return { errors: [`${file}: frontmatter がオブジェクトではありません`], warnings }
  }
  const d = fm as Record<string, unknown>

  if (d.source_ref !== bookId) {
    errors.push(`source_ref は "${bookId}" です: "${String(d.source_ref)}"`)
  }
  for (const key of ["id", "title"] as const) {
    if (typeof d[key] !== "string" || d[key] === "") errors.push(`\`${key}\` が空です`)
  }
  for (const key of ["order", "page_start"] as const) {
    if (typeof d[key] !== "number") errors.push(`\`${key}\` には数値が必要です: "${String(d[key])}"`)
  }
  if (typeof d.reviewed !== "boolean") errors.push("`reviewed` には true / false が必要です")

  const confidence = d.confidence
  if (typeof confidence !== "string" || !(SHISEKI_CONFIDENCES as readonly string[]).includes(confidence)) {
    errors.push(`\`confidence\` は ${SHISEKI_CONFIDENCES.join(" / ")} のいずれかです: "${String(confidence)}"`)
  }

  if (d.entities !== undefined && !Array.isArray(d.entities)) {
    errors.push("`entities` は配列です")
  }

  const summary = d.summary
  if (summary !== undefined && summary !== null && typeof summary !== "string") {
    errors.push("`summary` は文字列です")
  }
  const summaryText = typeof summary === "string" ? summary.trim() : ""
  if (d.reviewed === true && summaryText === "") {
    errors.push("`reviewed: true` なら `summary` が必要です")
  }
  if (summaryText.length > SUMMARY_MAX_CHARS) {
    warnings.push(`${file}: summary が${summaryText.length}字あります（推奨 ${SUMMARY_MAX_CHARS}字以内）`)
  }

  // 権利ガードレール: 番地は書かない。location だけでなく概要本文も見る
  if (typeof d.location === "string" && /番地/.test(d.location)) {
    errors.push(`\`location\` に番地が残っています（地区名までにする）: "${d.location}"`)
  }
  if (/番地/.test(summaryText)) {
    const m = /[^、。]{0,14}番地[一二三四五六七八九十\d]*/.exec(summaryText)
    errors.push(`\`summary\` に番地が残っています（地区名までにする）: "${m?.[0] ?? ""}"`)
  }

  return { errors, warnings }
}

// ── 要点カード（スキーマ §11）───────────────────────────────────────────────

/** カードの型。1枚=1メッセージ。先頭は必ず headline。 */
export const CARD_KINDS = ["headline", "number", "decision", "report", "question", "next"] as const
export type CardKind = (typeof CARD_KINDS)[number]

/** `value` が必須になる kind（数値・日付を主役にするカード）。 */
const VALUE_REQUIRED_KINDS: readonly CardKind[] = ["number", "next"]

export interface CardItem {
  kind:   CardKind
  title:  string
  /** 金額・日付など1つだけ。kind が number / next のときは必須 */
  value?: string
  detail: string
  /** セッション内のパートへの内部リンク。外部URLは書けない */
  link?:  string
}

export interface CardsData {
  session_id:   string
  generated_by: string
  generated_at: string
  /** カード自体の人間レビュー済みフラグ。false でもビルドは通す（Previewで見て直すため） */
  reviewed:     boolean
  cards:        CardItem[]
}

/** カードの枚数の下限・上限（スキーマ §11）。下限を下回るのは警告、上限超過はエラー。 */
export const CARDS_MIN = 5
export const CARDS_MAX = 8

const TITLE_MAX_CHARS  = 30
const DETAIL_MAX_CHARS = 120

export interface CardsValidation {
  errors:   string[]
  warnings: string[]
}

/**
 * cards.yaml の構造を検証する。
 * `partCount` を渡すと link のパート番号が実在するかまで見る（session.yaml の parts 数）。
 */
export function validateCards(data: unknown, sessionId: string, partCount?: number): CardsValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (typeof data !== "object" || data === null) {
    return { errors: ["cards.yaml がオブジェクトではありません"], warnings }
  }
  const d = data as Record<string, unknown>

  for (const key of ["generated_by", "generated_at"] as const) {
    if (typeof d[key] !== "string" || d[key] === "") errors.push(`\`${key}\` が必要です`)
  }
  if (typeof d.reviewed !== "boolean") {
    errors.push("`reviewed` には true / false が必要です")
  }
  if (!Array.isArray(d.cards)) {
    errors.push("`cards` の配列が必要です")
    return { errors, warnings }
  }

  const cards = d.cards as unknown[]
  if (cards.length === 0) errors.push("`cards` が空です")
  if (cards.length > CARDS_MAX) {
    errors.push(`カードは最大${CARDS_MAX}枚です。${cards.length}枚見つかりました`)
  } else if (cards.length > 0 && cards.length < CARDS_MIN) {
    warnings.push(`カードが${cards.length}枚しかありません（推奨 ${CARDS_MIN}〜${CARDS_MAX}枚）`)
  }

  cards.forEach((raw, i) => {
    const at = `cards[${i}]`
    if (typeof raw !== "object" || raw === null) {
      errors.push(`${at} がオブジェクトではありません`)
      return
    }
    const c = raw as Record<string, unknown>

    const kind = c.kind
    if (typeof kind !== "string" || !(CARD_KINDS as readonly string[]).includes(kind)) {
      errors.push(`${at}.kind は ${CARD_KINDS.join(" / ")} のいずれかです: "${String(kind)}"`)
    } else if (i === 0 && kind !== "headline") {
      // OGP画像は1枚目から作る。先頭が見出しでないと会期の要約として成立しない
      errors.push(`cards[0].kind は headline です: "${kind}"`)
    }

    for (const key of ["title", "detail"] as const) {
      if (typeof c[key] !== "string" || (c[key] as string).trim() === "") {
        errors.push(`${at}.${key} が空です`)
      }
    }
    if (typeof c.title === "string" && c.title.length > TITLE_MAX_CHARS) {
      warnings.push(`${at}.title が${c.title.length}字あります（推奨 ${TITLE_MAX_CHARS}字以内）`)
    }
    if (typeof c.detail === "string" && c.detail.length > DETAIL_MAX_CHARS) {
      warnings.push(`${at}.detail が${c.detail.length}字あります（推奨 ${DETAIL_MAX_CHARS}字以内）`)
    }

    if (typeof kind === "string" && VALUE_REQUIRED_KINDS.includes(kind as CardKind)) {
      if (typeof c.value !== "string" || c.value.trim() === "") {
        errors.push(`${at}.value は kind: ${kind} では必須です`)
      }
    }
    if (c.value !== undefined && typeof c.value !== "string") {
      errors.push(`${at}.value は文字列です`)
    }

    if (c.link !== undefined) {
      const link = c.link
      if (typeof link !== "string") {
        errors.push(`${at}.link は文字列です`)
      } else {
        const m = new RegExp(`^/gikai/sessions/${sessionId}/(\\d+)$`).exec(link)
        if (!m) {
          errors.push(`${at}.link は "/gikai/sessions/${sessionId}/{パート番号}" 形式です: "${link}"`)
        } else if (partCount !== undefined && Number(m[1]) >= partCount) {
          errors.push(`${at}.link のパート番号 ${m[1]} は存在しません（パートは0〜${partCount - 1}）`)
        }
      }
    }

    for (const key of Object.keys(c)) {
      if (!["kind", "title", "value", "detail", "link"].includes(key)) {
        errors.push(`${at} に未知のキー「${key}」があります`)
      }
    }
  })

  for (const key of Object.keys(d)) {
    if (!["generated_by", "generated_at", "reviewed", "cards"].includes(key)) {
      errors.push(`cards.yaml に未知のキー「${key}」があります`)
    }
  }

  return { errors, warnings }
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
  CardsData:            ["session_id", "generated_by", "generated_at", "reviewed", "cards"],
  CardItem:             ["kind", "title", "value", "detail", "link"],
  // 郷土資料（§12）。本文フィールドをここに足さないこと（権利ガードレール4）
  ShisekiData:          ["book", "items"],
  BookMeta:             ["id", "title", "publisher", "year", "citation", "citation_note"],
  ShisekiItem:          ["id", "title", "order", "page_start", "page_end", "confidence", "reviewed",
                         "location", "era", "entities", "summary"],
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
