// Telegram 通知。送るのは3種類だけ（PR作成／字幕待ち保留／推定不能で停止）。
//
// トークンが無い環境（ローカルのドライラン等）では黙って諦めず、理由をログに出してスキップする。
// 通知の失敗でパイプライン自体を落とさない — 取り込みは済んでいるのに Actions が赤くなる方が困る。

/**
 * 取り込みで飛ぶのは3種類（pr / pending / blocked）。
 * test は `--notify-test` の疎通確認専用、ci はワークフロー自体の失敗
 * （notify-failed-runs.ts）で、見出しは呼び出し側が組み立てる。
 */
export type NotifyKind = "pr" | "pending" | "blocked" | "test" | "ci"

const HEADING: Record<NotifyKind, string> = {
  pr:      "🟢 PRを作成しました",
  pending: "⏳ 字幕待ちで保留",
  blocked: "🛑 推定できず停止",
  test:    "🔔 通知テスト",
  ci:      "",
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export async function notify(kind: NotifyKind, title: string, lines: string[]): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  const heading = HEADING[kind]
  const text = [
    ...(heading ? [`<b>${escapeHtml(heading)}</b>`] : []),
    escapeHtml(title),
    "",
    ...lines.map(escapeHtml),
  ].join("\n")

  if (!token || !chatId) {
    console.warn("⚠️  TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID が未設定のため通知をスキップします。")
    console.warn(text.replace(/<\/?b>/g, ""))
    return
  }


  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        // 動画URLのプレビューでタイムラインが埋まるのを避ける
        link_preview_options: { is_disabled: true },
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`)
    console.log(`   📨 Telegram に通知しました（${kind}）`)
  } catch (err) {
    console.warn(`⚠️  Telegram への通知に失敗: ${err instanceof Error ? err.message : err}`)
  }
}
