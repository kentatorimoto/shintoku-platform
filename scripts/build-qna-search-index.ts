/**
 * public/data/qna/*.json を読み込み、検索用の複合インデックスを生成する
 * 出力: public/data/qna_search_index.json
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
}

main().catch((err) => {
  console.error("Failed:", err)
  process.exit(1)
})
