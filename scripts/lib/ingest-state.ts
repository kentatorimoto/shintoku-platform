// 自動取り込みの状態（data/watch/ingest-state.json）。
//
// 動画IDをキーにした1ファイル。GitHub Issue の状態と二重管理しないため、
// ここが持つのは「機械が次に何をするか」だけ（何回試したか・いつ諦めたか）。
// 人間向けの説明は Issue コメントに書く。

import fs from "fs"
import path from "path"

const ROOT = process.cwd()
export const STATE_PATH = path.join(ROOT, "data", "watch", "ingest-state.json")

export type IngestStatus =
  /** MDまで生成してPRに載せた */
  | "done"
  /** 字幕が未生成（exit 2）。翌日以降に再試行する */
  | "pending"
  /** 字幕待ちを諦めた（TRANSCRIPT_RETRY_DAYS 超過） */
  | "gave_up"
  /** 字幕が恒久的に無効（exit 3）。再試行しない */
  | "disabled"
  /** 対応表で推定できず停止した。表を直すか人間が手で入れる */
  | "blocked"
  /** 抽出・検証に失敗した。人間が対処する */
  | "failed"

export interface VideoRecord {
  issue:      number
  title:      string
  url:        string
  status:     IngestStatus
  sessionId?: string
  partFile?:  string
  label?:     string
  partType?:  string
  /** YYYY-MM-DD（開催日） */
  date?:      string
  /** 「最終日」で date / sortDate を更新したときの内容 */
  dateNote?:  string
  /** 推定の根拠。PR本文の材料になる */
  trace?:     string[]
  /** JST の YYYY-MM-DD */
  firstSeen:  string
  lastTried:  string
  attempts:   number
  note?:      string
  prUrl?:     string
}

export interface IngestState {
  version: 1
  videos:  Record<string, VideoRecord>
}

const EMPTY: IngestState = { version: 1, videos: {} }

export function loadState(): IngestState {
  if (!fs.existsSync(STATE_PATH)) return structuredClone(EMPTY)
  const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as Partial<IngestState>
  return { version: 1, videos: parsed.videos ?? {} }
}

export function saveState(state: IngestState) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  // キー順を固定して diff を読めるようにする
  const videos = Object.fromEntries(Object.entries(state.videos).sort(([a], [b]) => a.localeCompare(b)))
  fs.writeFileSync(STATE_PATH, JSON.stringify({ version: 1, videos }, null, 2) + "\n")
}

/** 議会も Actions のスケジュールも日本時間で考えるので、日付はJSTで持つ */
export function todayJst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}

export function daysSince(isoDate: string): number {
  const from = Date.parse(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(from)) return 0
  return Math.floor((Date.parse(`${todayJst()}T00:00:00Z`) - from) / 86_400_000)
}

/**
 * 再試行の対象か。
 * `blocked` も対象に含める — 対応表を直せば次の実行でそのまま進んでほしいため
 * （同じ理由で止まり続けても、Issueコメントと通知は重複させない）。
 * 触らないのは `done`（済み）・`gave_up`（諦めた）・`disabled`（字幕が無い）だけ。
 */
export function isRetryable(record: VideoRecord | undefined): boolean {
  if (!record) return true
  return record.status === "pending" || record.status === "failed" || record.status === "blocked"
}
