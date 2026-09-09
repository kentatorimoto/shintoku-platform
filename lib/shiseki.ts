// 史跡データの読み込みと、UIで使う小さな導出。
//
// 公開できるのは概要レベルまで（docs/content-schema.md §12.1）。
// ここで本文を読みにいかないこと——`public/data/archive/shiseki.json` には
// そもそも本文が入っていない。

import fs from "fs"
import path from "path"
import type { ShisekiData, ShisekiItem } from "@/scripts/lib/schema"

export function getShiseki(): ShisekiData | null {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "archive", "shiseki.json")
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ShisekiData
  } catch {
    return null
  }
}

export function findShiseki(id: string): { data: ShisekiData; item: ShisekiItem } | null {
  const data = getShiseki()
  const item = data?.items.find(i => i.id === id)
  return data && item ? { data, item } : null
}

/**
 * 一覧に出す1文目だけを取り出す。
 * 26件を通して読むと3文構造の反復が目立つため、一覧では冒頭の一文に絞る。
 */
export function leadSentence(summary: string | undefined): string {
  if (!summary) return ""
  const end = summary.indexOf("。")
  return end === -1 ? summary : summary.slice(0, end + 1)
}

/** `p.{page}` を実際のページ番号に差し替える。 */
export function citationFor(citation: string, item: ShisekiItem): string {
  const page = item.page_end && item.page_end !== item.page_start
    ? `${item.page_start}-${item.page_end}`
    : String(item.page_start)
  return citation.replace("{page}", page)
}
