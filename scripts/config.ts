// 字幕→MD抽出パイプラインの設定。ここ以外にモデル名・閾値を散らさない。

// ── Claude API ──────────────────────────────────────────────────────────────

/** 抽出に使うモデル。変更はこの1行だけで済む。 */
export const MODEL = "claude-sonnet-4-6"

/** 1リクエストの出力上限。128Kまで指定できるが、抽出MDは長くても数万トークン。 */
export const MAX_TOKENS = 32000

/** 思考の深さ。low | medium | high | max */
export const EFFORT = "high" as const

/** バリデーションエラーをAPIに返して直させる回数の上限。 */
export const MAX_SELF_CORRECTION_ROUNDS = 2

/**
 * 概算コスト表示用の単価（USD / 100万トークン）。
 * 請求額そのものではなく「桁を間違えていないか」を確認するための目安。
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-sonnet-5":   { input: 3.0, output: 15.0 },
  "claude-opus-4-8":   { input: 5.0, output: 25.0 },
  "claude-haiku-4-5":  { input: 1.0, output: 5.0 },
}

// ── YouTube ─────────────────────────────────────────────────────────────────

/** 新得町議会のYouTubeチャンネル（RSS監視の対象）。 */
export const COUNCIL_CHANNEL_ID = "UC8YKJ8zgl7CoGL0kapCPMzg"

/**
 * 公開からこの時間内に字幕が無ければ「まだ生成されていない」と判断して再試行を促す。
 * これを過ぎても無ければ「字幕が恒久的に無効」と判断する。
 * 自動字幕は通常数時間で付くが、長時間の議会中継は遅れることがあるので余裕を取る。
 */
export const TRANSCRIPT_PENDING_WINDOW_HOURS = 48

// ── exit code 規約（watcher・CLI・CI で共有する）─────────────────────────────

export const EXIT = {
  /** 成功 */
  OK: 0,
  /** エラー。人間が対処する必要がある（URL不正・動画が視聴不可・ネットワーク等） */
  ERROR: 1,
  /** 字幕がまだ生成されていない。数時間後に再試行すれば取れる見込み */
  TRANSCRIPT_PENDING: 2,
  /** 字幕が恒久的に無効。再試行しても取れないのでスキップする */
  TRANSCRIPT_DISABLED: 3,
} as const
