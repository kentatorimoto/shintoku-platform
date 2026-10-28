// 外部通信の短いリトライ。母艦ランナー（self-hosted）は一瞬ネットワークが切れることがあるので、
// 一時的な失敗だけを待って再試行し、使い切ったときだけ失敗にする。
//
// 再試行するのは「通信が届かなかった／相手が一時的に落ちていた」と読めるものだけ。
// 認証エラー・4xx・存在しないブランチ等は何度やっても同じなので即座に投げ直す。

import { RETRY_DELAYS_MS } from "../config"

const TRANSIENT_PATTERNS = [
  /error connecting to/i,            // gh
  /could not resolve host/i,         // git
  /failed to connect/i,
  /connection (reset|refused|timed out|closed)/i,
  /remote end hung up/i,
  /early EOF/i,
  /RPC failed/i,
  /TLS handshake timeout/i,
  /i\/o timeout/i,
  /timed? ?out/i,
  /\bHTTP 5\d\d\b/,                  // gh・自前の fetch
  /\b(502|503|504) (Bad Gateway|Service Unavailable|Gateway Time-?out)/i,
  /fetch failed/i,                   // Node の fetch（undici）
  /socket hang up/i,
  /Connection error/i,               // Anthropic SDK の APIConnectionError
]

const TRANSIENT_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
])

/**
 * execFileSync のエラーは stderr に本当の理由が入っている。message の方はコマンドライン全体
 * （PR本文等の引数を含む）なので、そこで照合すると本文中の語に誤反応する。stderr があればそちらだけ見る。
 */
function describe(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const stderr = (err as { stderr?: unknown }).stderr
  return stderr ? String(stderr) : err.message
}

export function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  // Anthropic SDK の APIError は status を持つ（529 = overloaded）
  const status = (err as { status?: unknown }).status
  if (typeof status === "number" && status >= 500) return true

  const code = (err as { code?: unknown }).code ?? (err.cause as { code?: unknown } | undefined)?.code
  if (typeof code === "string" && TRANSIENT_CODES.has(code)) return true

  const text = describe(err)
  return TRANSIENT_PATTERNS.some(re => re.test(text))
}

function warnRetry(label: string, err: unknown, attempt: number, delayMs: number) {
  const reason = describe(err).split("\n").map(l => l.trim()).filter(Boolean)[0] ?? ""
  console.warn(
    `   ↻ ${label}: 一時的な失敗（${attempt}/${RETRY_DELAYS_MS.length}回目の再試行を` +
    `${delayMs / 1000}秒後に行います）: ${reason}`,
  )
}

/** execFileSync を包む用。同期のまま待つ（呼び出し側を async にしなくて済む）。 */
export function retrySync<T>(label: string, fn: () => T): T {
  for (let attempt = 0; ; attempt++) {
    try {
      return fn()
    } catch (err) {
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined || !isTransient(err)) throw err
      warnRetry(label, err, attempt + 1, delay)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay)
    }
  }
}

export async function retryAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined || !isTransient(err)) throw err
      warnRetry(label, err, attempt + 1, delay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
