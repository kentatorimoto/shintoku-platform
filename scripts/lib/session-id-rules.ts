// Issue タイトル → セッションID・パート・種別の対応表。
//
// 規律: **表にあるパターンだけを推定する。** 曖昧なものは推定せず reason を返し、
// 呼び出し側（auto-ingest.ts）が Issue にコメントして止まる。推測で埋めない。
//
// 推定の根拠は trace に機械的に積み、PR本文にそのまま書き出す。
// 推定が外れたとき「どの規則が誤動作したか」をレビュー側が一目で追えるようにするため。
//
// 運用と表の全文は docs/auto-ingest.md を見ること。

import type { PartType } from "../extract-md"

/** 令和1年 = 2019年 */
const ERA_BASE = 2018

// ── タイトルの正規化とパース ────────────────────────────────────────────────

/**
 * 町のタイトルは全角数字・全角空白で書かれ、まれに全半角が混ざる
 * （実例: `令和８年９月１4日　決算特別委員会　午前`）。比較の前に必ず通す。
 */
export function normalizeTitle(raw: string): string {
  return raw
    .replace(/^\s*\[新着動画\]\s*/, "")
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)) // 全角数字
    .replace(/[－‐-―]/g, "-")                                          // 全角ハイフン類
    .replace(/[　\s]+/g, " ")                                                    // 全角空白を含む空白
    .trim()
}

export interface ParsedTitle {
  /** YYYY-MM-DD */
  date:      string
  eraYear:   number
  month:     number
  day:       number
  /** 会議名ブロック（例: `定例第3回` `決算特別委員会`） */
  meeting:   string
  /** パート名ブロック（例: `初日` `一般質問②` `午前`） */
  part:      string
}

const DATE_RE = /^令和(\d+)年(\d+)月(\d+)日\s*/

const pad = (n: number) => String(n).padStart(2, "0")

/** `令和8年9月14日 決算特別委員会 午前` → 日付・会議名・パート名。読めなければ null。 */
export function parseTitle(rawTitle: string): ParsedTitle | null {
  const title = normalizeTitle(rawTitle)
  const m = DATE_RE.exec(title)
  if (!m) return null

  const eraYear = Number(m[1])
  const month   = Number(m[2])
  const day     = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const rest = title.slice(m[0].length).trim()
  if (!rest) return null

  // 臨時会は1本で完結することが多く、パート名が付かない（例: `令和8年7月6日 臨時第3回`）。
  // 表2の「（パート名なし）」がこれを受ける。
  const sep = rest.indexOf(" ")

  return {
    date:    `${ERA_BASE + eraYear}-${pad(month)}-${pad(day)}`,
    eraYear,
    month,
    day,
    meeting: sep < 0 ? rest : rest.slice(0, sep).trim(),
    part:    sep < 0 ? ""   : rest.slice(sep + 1).trim(),
  }
}

// ── 表1: 会議名 → セッションID ──────────────────────────────────────────────

/** `session` = 本会議の会期（日ごとに day{n}）／`committee` = 委員会（午前・午後で part{n}） */
export type MeetingKind = "session" | "committee"

interface MeetingRule {
  /** trace に出す行の名前 */
  name:          string
  pattern:       RegExp
  kind:          MeetingKind
  /** セッションIDの末尾（例: `regular-3` `kessan-tokubetsu`） */
  slug:          (m: RegExpMatchArray) => string
  /** 新規セッションに付ける会議種別・議案種別タグ（docs/content-schema.md §10）。テーマタグは人が足す */
  tags:          string[]
  officialTitle: (t: ParsedTitle, m: RegExpMatchArray) => string
}

/**
 * 年度の扱いは会議で逆になる。混同しないこと。
 *   決算特別委員会（9月）= 前年度の決算審査 → 元号年 − 1
 *   予算特別委員会（3月）= 当年度の予算審査 → 元号年
 */
export const MEETING_RULES: MeetingRule[] = [
  {
    name:    "定例第{N}回",
    pattern: /^定例第(\d+)回$/,
    kind:    "session",
    slug:    m => `regular-${Number(m[1])}`,
    tags:    ["定例会"],
    officialTitle: (t, m) => `令和${t.eraYear}年第${Number(m[1])}回新得町議会定例会`,
  },
  {
    name:    "臨時第{N}回",
    pattern: /^臨時第(\d+)回$/,
    kind:    "session",
    // R8以降は2桁ゼロ埋め（r8-2026-04-rinji-02）。R7以前の1桁は既存IDへの合流で吸収する
    slug:    m => `rinji-${pad(Number(m[1]))}`,
    tags:    ["臨時会"],
    officialTitle: (t, m) => `令和${t.eraYear}年第${Number(m[1])}回新得町議会臨時会`,
  },
  {
    name:    "決算特別委員会",
    pattern: /^決算特別委員会$/,
    kind:    "committee",
    slug:    () => "kessan-tokubetsu",
    tags:    ["特別委員会", "決算"],
    officialTitle: t =>
      `令和${t.eraYear}年${t.month}月${t.day}日 決算特別委員会（令和${t.eraYear - 1}年度）`,
  },
  {
    name:    "予算特別委員会",
    pattern: /^予算特別委員会$/,
    kind:    "committee",
    slug:    () => "yosan-tokubetsu",
    tags:    ["特別委員会", "当初予算"],
    officialTitle: t =>
      `令和${t.eraYear}年${t.month}月${t.day}日 予算特別委員会（令和${t.eraYear}年度）`,
  },
]

// ── 表2: パート名 → part / type ────────────────────────────────────────────

interface PartLabelCtx {
  month:     number
  day:       number
  /** 委員会が複数日にわたるときの「N日目」。1日目は省略する */
  dayNumber: number
  mark:      string
}

interface PartRule {
  name:        string
  pattern:     RegExp
  /** この規則を適用できる会議の種類。合わなければ推定しない */
  kind:        MeetingKind
  type:        PartType
  /** 同じ日に複数パートが来たときの処理順（小さい方が先） */
  ordinal:     (m: RegExpMatchArray) => number
  label:       (ctx: PartLabelCtx) => string
  /** true のとき date / sortDate を更新する（§2.1・会期の代表日は最終日） */
  isFinalDay?: boolean
}

/** `一般質問②` の丸数字。②以降だけ出てくるので ① は使わない */
const MARKS = "①②③④⑤⑥⑦⑧⑨⑩"

export const PART_RULES: PartRule[] = [
  {
    name:    "初日",
    pattern: /^初日$/,
    kind:    "session",
    type:    "honkaigi",
    ordinal: () => 0,
    label:   c => `初日（${c.month}/${c.day}）`,
  },
  {
    name:    "本会議",
    pattern: /^本会議$/,
    kind:    "session",
    type:    "honkaigi",
    ordinal: () => 1,
    label:   c => `本会議（${c.month}/${c.day}）`,
  },
  {
    name:    "一般質問（②③…）",
    pattern: new RegExp(`^一般質問([${MARKS}]?)$`),
    kind:    "session",
    type:    "qna",
    ordinal: m => 10 + Math.max(0, MARKS.indexOf(m[1] ?? "")),
    label:   c => `一般質問${c.mark}（${c.month}/${c.day}）`,
  },
  {
    name:    "最終日",
    pattern: /^最終日$/,
    kind:    "session",
    type:    "honkaigi",
    ordinal: () => 90,
    label:   c => `最終日（${c.month}/${c.day}）`,
    isFinalDay: true,
  },
  {
    // 臨時会は1本で完結することが多い。既存の r8-2026-01-27-rinji-01 / r8-2026-04-rinji-02 も
    // パート1本（本会議）で、いずれも honkaigi。
    name:    "（パート名なし）",
    pattern: /^$/,
    kind:    "session",
    type:    "honkaigi",
    ordinal: () => 1,
    label:   c => `本会議（${c.month}/${c.day}）`,
  },
  {
    name:    "午前",
    pattern: /^午前$/,
    kind:    "committee",
    type:    "qna",
    ordinal: () => 0,
    label:   c => (c.dayNumber > 1 ? `${c.dayNumber}日目 午前（${c.month}/${c.day}）` : "午前"),
  },
  {
    name:    "午後",
    pattern: /^午後$/,
    kind:    "committee",
    type:    "qna",
    ordinal: () => 1,
    label:   c => (c.dayNumber > 1 ? `${c.dayNumber}日目 午後（${c.month}/${c.day}）` : "午後"),
  },
]

// ── 既存セッションの読み取り口 ──────────────────────────────────────────────

export interface SessionSnapshot {
  id:        string
  /** session.yaml の parts 数。新しいパートはこの直後に積む */
  partCount: number
  /** 既存パートの開催日（MDの session_date。無ければ ""） */
  partDates: string[]
  /** 既に取り込んだ動画URL。冪等判定に使う */
  youtubeUrls: string[]
}

/** content/sessions/ を読む口。テストとドライランで差し替えられるようにする */
export interface SessionRepo {
  listIds(): string[]
  load(id: string): SessionSnapshot | null
}

// ── 推定 ────────────────────────────────────────────────────────────────────

export interface Inference {
  sessionId:     string
  isNewSession:  boolean
  /** `day2` / `part1` — スキーマ §1 の命名 */
  partFile:      string
  partIndex:     number
  type:          PartType
  label:         string
  /** YYYY-MM-DD */
  date:          string
  ordinal:       number
  isFinalDay:    boolean
  meetingKind:   MeetingKind
  /** 新規セッションのときだけ使う */
  newSessionTags:          string[]
  newSessionOfficialTitle: string
  /** 推定の根拠。PR本文と Issue コメントにそのまま出す */
  trace:         string[]
}

export type InferResult =
  | { ok: true;  inference: Inference }
  | { ok: false; reason: string; trace: string[] }

/**
 * 推定IDが存在しなくても、日付の入ったIDで同じ会議が既にあるなら合流する
 * （実例: 推定 `r8-2026-01-rinji-01` に対し既存は `r8-2026-01-27-rinji-01`）。
 * 候補が2つ以上あるときは推定しない。
 */
export function resolveExistingId(
  inferredId: string,
  prefix: string,
  slug: string,
  existingIds: string[],
): { id: string; note: string | null } | { ambiguous: string[] } {
  if (existingIds.includes(inferredId)) return { id: inferredId, note: null }

  const candidates = existingIds.filter(id => id.startsWith(prefix) && id.endsWith(`-${slug}`))
  if (candidates.length === 1) {
    return { id: candidates[0], note: `既存の ${candidates[0]} に合流（IDに日付が入っている形）` }
  }
  if (candidates.length > 1) return { ambiguous: candidates }

  return { id: inferredId, note: null }
}

export function infer(rawTitle: string, repo: SessionRepo): InferResult {
  const trace: string[] = []
  const normalized = normalizeTitle(rawTitle)
  trace.push(`正規化: 「${normalized}」`)

  const parsed = parseTitle(rawTitle)
  if (!parsed) {
    return { ok: false, reason: "タイトルを「和暦日付 / 会議名 / パート名」に分解できませんでした。", trace }
  }
  trace.push(`日付: タイトルの「令和${parsed.eraYear}年${parsed.month}月${parsed.day}日」→ ${parsed.date}（公開日は使わない）`)

  // 表1
  const meetingHit = MEETING_RULES
    .map(rule => ({ rule, m: parsed.meeting.match(rule.pattern) }))
    .find((x): x is { rule: MeetingRule; m: RegExpMatchArray } => x.m !== null)

  if (!meetingHit) {
    return {
      ok: false,
      reason: `会議名「${parsed.meeting}」が表1にありません。` +
              `（表1: ${MEETING_RULES.map(r => r.name).join(" / ")}）`,
      trace,
    }
  }

  const slug   = meetingHit.rule.slug(meetingHit.m)
  const prefix = `r${parsed.eraYear}-${ERA_BASE + parsed.eraYear}-${pad(parsed.month)}`
  const inferredId = `${prefix}-${slug}`

  const resolved = resolveExistingId(inferredId, prefix, slug, repo.listIds())
  if ("ambiguous" in resolved) {
    return {
      ok: false,
      reason: `既存セッションの候補が複数あります: ${resolved.ambiguous.join(", ")}`,
      trace,
    }
  }
  const sessionId = resolved.id
  trace.push(`表1「${meetingHit.rule.name}」→ ${sessionId}`)
  if (resolved.note) trace.push(`　${resolved.note}`)

  // 表2
  const partHit = PART_RULES
    .map(rule => ({ rule, m: parsed.part.match(rule.pattern) }))
    .find((x): x is { rule: PartRule; m: RegExpMatchArray } => x.m !== null)

  if (!partHit) {
    return {
      ok: false,
      reason: `パート名「${parsed.part}」が表2にありません。` +
              `（表2: ${PART_RULES.map(r => r.name).join(" / ")}）`,
      trace,
    }
  }
  if (partHit.rule.kind !== meetingHit.rule.kind) {
    return {
      ok: false,
      reason:
        `パート名「${parsed.part}」は${partHit.rule.kind === "committee" ? "委員会" : "本会議の会期"}用の規則で、` +
        `会議「${parsed.meeting}」（${meetingHit.rule.kind === "committee" ? "委員会" : "本会議の会期"}）には使えません。`,
      trace,
    }
  }

  const snapshot = repo.load(sessionId)
  const isNewSession = snapshot === null
  const partIndex = snapshot?.partCount ?? 0
  const partFile = `${meetingHit.rule.kind === "session" ? "day" : "part"}${partIndex + 1}`

  // 委員会が日をまたぐときのラベル用。既存パートの日付の種類数で「N日目」を決める
  const knownDates = [...new Set((snapshot?.partDates ?? []).filter(Boolean))]
  const dayNumber = knownDates.includes(parsed.date)
    ? knownDates.indexOf(parsed.date) + 1
    : knownDates.length + 1

  const label = partHit.rule.label({
    month: parsed.month,
    day:   parsed.day,
    dayNumber,
    mark:  partHit.m[1] ?? "",
  })

  trace.push(
    `表2「${partHit.rule.name}」→ ${partFile}（既存 ${partIndex} パートの次）/ ` +
    `type=${partHit.rule.type} / label「${label}」`,
  )
  if (isNewSession) {
    trace.push(`新規セッション: tags=[${meetingHit.rule.tags.join(", ")}] / officialTitle「${meetingHit.rule.officialTitle(parsed, meetingHit.m)}」`)
  }
  if (partHit.rule.isFinalDay) {
    trace.push(`「最終日」ラベルのため date を ${parsed.date} に更新し、sortDate に会期初日を入れる（スキーマ §2.1）`)
  }

  return {
    ok: true,
    inference: {
      sessionId,
      isNewSession,
      partFile,
      partIndex,
      type:        partHit.rule.type,
      label,
      date:        parsed.date,
      ordinal:     partHit.rule.ordinal(partHit.m),
      isFinalDay:  partHit.rule.isFinalDay === true,
      meetingKind: meetingHit.rule.kind,
      newSessionTags:          meetingHit.rule.tags,
      newSessionOfficialTitle: meetingHit.rule.officialTitle(parsed, meetingHit.m),
      trace,
    },
  }
}
