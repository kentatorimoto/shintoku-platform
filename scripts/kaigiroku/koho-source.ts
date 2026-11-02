// 広報しんとくの本文を content/koho から読む。個人の欄として置き換えたページは返さない。

import fs from "fs"
import path from "path"
import { maskedReason } from "../lib/koho-personal"
import type { KohoIssue } from "../lib/koho-issue"

export interface KohoSourceIssue {
  key: string
  date: string
  /** 例: 広報しんとく 令和7年2月号 */
  label: string
  url: string
  pages: { page: number; text: string }[]
}

const ROOT = process.cwd()

/** 月号だけを読む。お知らせ号は催しの案内が中心で、町の説明の記事ではないため */
export function loadKohoIssues(): KohoSourceIssue[] {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "koho", "index.json"), "utf-8")) as KohoIssue[]
  return index.filter(i => i.status === "text" && i.kind === "monthly").map((i) => {
    const raw = fs.readFileSync(path.join(ROOT, "content", "koho", i.key, "raw.txt"), "utf-8").split("\f")
    const ym = /(?:令和|平成)(?:元|[0-9０-９]+)年|\d{4}年/.exec(i.title)?.[0] ?? `${i.year}年`
    return {
      key: i.key, date: i.date, url: i.url,
      label: `広報しんとく ${ym}${i.month}月号`,
      pages: raw.flatMap((text, n) => (maskedReason(text) ? [] : [{ page: n + 1, text }])),
    }
  })
}
