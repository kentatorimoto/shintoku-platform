// 表示のための小さな文字列操作。fs を読まないので Client Component からも使える。

/**
 * 一覧に出す1文目だけを取り出す。
 *
 * 一覧で長い要約を出すと、途中でぶつ切りになる（line-clamp）か、行数が揃わなくなる。
 * 文の切れ目で切るので、どこまで読んだのかが読者に分かる。
 * /shiseki の一覧と /gikai/sessions の一覧で共用する。
 */
export function leadSentence(summary: string | undefined): string {
  if (!summary) return ""
  const end = summary.indexOf("。")
  return end === -1 ? summary : summary.slice(0, end + 1)
}
