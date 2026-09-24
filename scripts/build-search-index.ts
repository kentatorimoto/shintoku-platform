/**
 * 横断検索（GlobalSearch）が読む索引を作る。
 *
 *   public/data/qna/*.json        → public/data/qna_search_index.json
 *   data/scraped/announcements-*  → public/data/announcements.json
 *
 * 広報しんとくの全文（newsletters_index.json）は index-newsletters.ts が作る。
 * ここでは触らない（週次で更新される素材をビルドのたびに作り直さない）。
 */
import fs from "fs"
import path from "path"

interface QnaItem {
  speaker_name: string
  topic_title: string
  topic_tags?: string[]
}

interface HonkaigiItem {
  bill_number: string
  bill_title: string
  bill_tags?: string[]
}

interface QnaFile {
  session_id: string
  part_index: number
  part_type?: string
  items: (QnaItem | HonkaigiItem)[]
}

interface SearchEntry {
  type: "qna" | "honkaigi"
  sessionId: string
  partIndex: number
  title: string
  speaker?: string
  tags: string[]
  billNumber?: string
}

async function main() {
  const qnaDir = path.resolve("public/data/qna")
  const files = fs.readdirSync(qnaDir).filter((f) => f.endsWith(".json") && f !== "manifest.json")

  const entries: SearchEntry[] = []

  for (const file of files) {
    const raw = fs.readFileSync(path.join(qnaDir, file), "utf-8")
    const data: QnaFile = JSON.parse(raw)

    for (const item of data.items) {
      if (data.part_type === "honkaigi") {
        const h = item as HonkaigiItem
        entries.push({
          type: "honkaigi",
          sessionId: data.session_id,
          partIndex: data.part_index,
          title: h.bill_title,
          tags: h.bill_tags ?? [],
          billNumber: h.bill_number,
        })
      } else {
        const q = item as QnaItem
        entries.push({
          type: "qna",
          sessionId: data.session_id,
          partIndex: data.part_index,
          title: q.topic_title,
          speaker: q.speaker_name,
          tags: q.topic_tags ?? [],
        })
      }
    }
  }

  const outPath = path.resolve("public/data/qna_search_index.json")
  fs.writeFileSync(outPath, JSON.stringify(entries, null, 2), "utf-8")
  console.log(`Built QNA search index: ${entries.length} entries → ${outPath}`)

  buildAnnouncements()
}

// ── お知らせ ────────────────────────────────────────────────────────────────

interface Announcement {
  title:    string
  date:     string
  category: string
  url:      string
}

/**
 * data/scraped/ の最新スナップショットを public/data/announcements.json に写す。
 *
 * data/scraped/ は配信対象外（毎日コミットされる生データ）なので、
 * 検索で使う分だけを public に出す。取れなければ空配列を書いて先に進む
 * （お知らせが無いだけでビルドを止める理由はない）。
 */
function buildAnnouncements() {
  const outPath = path.resolve("public/data/announcements.json")
  const dir = path.resolve("data/scraped")

  let items: Announcement[] = []
  try {
    const latest = fs.readdirSync(dir)
      .filter(f => f.startsWith("announcements-") && f.endsWith(".json"))
      .sort()
      .pop()
    if (latest) {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, latest), "utf-8")) as Announcement[]
      // 同じお知らせが複数スナップショットに出るので、URLで一意にする
      const seen = new Set<string>()
      items = raw.filter(a => a.url && !seen.has(a.url) && seen.add(a.url))
      console.log(`Built announcements index: ${items.length} entries（${latest}）→ ${outPath}`)
    } else {
      console.warn("⚠️  data/scraped/ にお知らせのスナップショットがありません。空で出力します。")
    }
  } catch (err) {
    console.warn(`⚠️  お知らせの読み込みに失敗しました（空で出力します）: ${err instanceof Error ? err.message : err}`)
  }

  fs.writeFileSync(outPath, JSON.stringify(items, null, 2) + "\n", "utf-8")
}

main().catch((err) => {
  console.error("Failed:", err)
  process.exit(1)
})
