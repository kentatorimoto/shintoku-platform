import axios from "axios"
import fs from "fs"
import path from "path"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse")

interface Newsletter {
  title: string
  date: string
  url: string
  format: string
  sizeBytes?: number
}

interface PageEntry {
  page: number
  text: string
}

interface IndexEntry {
  title: string
  date: string
  url: string
  pages: PageEntry[]
}

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim()
}

async function extractPages(buf: Uint8Array): Promise<PageEntry[]> {
  const parser = new PDFParse(buf, { verbosity: 0 })
  try {
    const result = await parser.getText()
    return (result.pages ?? []).map((p: { num: number; text: string }) => ({
      page: p.num,
      text: normalizeText(p.text),
    }))
  } finally {
    parser.destroy()
  }
}

async function main() {
  const dataDir = path.join(process.cwd(), "data")
  const srcPath = path.join(dataDir, "newsletters.json")
  const outDir = path.join(process.cwd(), "public", "data")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "newsletters_index.json")

  const allNewsletters: Newsletter[] = JSON.parse(fs.readFileSync(srcPath, "utf-8"))
  const limit = Number(process.env.NEWSLETTER_INDEX_LIMIT || allNewsletters.length)
  const target = allNewsletters.slice(0, limit)

  console.log(`Processing ${target.length} / ${allNewsletters.length} newsletters`)

  // Load existing index for diff update
  const existing = new Map<string, IndexEntry>()
  if (fs.existsSync(outPath)) {
    const prev: IndexEntry[] = JSON.parse(fs.readFileSync(outPath, "utf-8"))
    for (const entry of prev) {
      existing.set(entry.url, entry)
    }
  }

  const results: IndexEntry[] = []
  let successCount = 0
  let skipCount = 0
  const failedUrls: string[] = []

  for (const nl of target) {
    // Reuse existing entry if already indexed (only if new pages format)
    const cached = existing.get(nl.url)
    if (cached && cached.pages) {
      results.push(cached)
      skipCount++
      console.log(`[skip] ${nl.title} (already indexed)`)
      continue
    }

    console.log(`[fetch] ${nl.title} ...`)
    try {
      const resp = await axios.get<ArrayBuffer>(nl.url, {
        responseType: "arraybuffer",
        timeout: 120_000,
        headers: {
          "User-Agent": "ShintokuPlatformBot/1.0 (+https://github.com/shintoku-platform)",
        },
      })
      const pages = await extractPages(new Uint8Array(resp.data))

      results.push({
        title: nl.title,
        date: nl.date,
        url: nl.url,
        pages,
      })
      successCount++
      const totalChars = pages.reduce((s, p) => s + p.text.length, 0)
      console.log(`  -> ${pages.length} pages, ${totalChars} chars extracted`)
    } catch (err) {
      failedUrls.push(nl.url)
      console.error(`  -> FAILED, skipping: ${err instanceof Error ? err.message : err}`)
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n")

  console.log(`\n--- Summary ---`)
  console.log(`Success: ${successCount}`)
  console.log(`Skipped (cached): ${skipCount}`)
  console.log(`Failed: ${failedUrls.length}`)
  if (failedUrls.length > 0) {
    console.log(`Failed URLs:`)
    for (const u of failedUrls) console.log(`  - ${u}`)
  }
  console.log(`Saved ${results.length} entries to ${outPath}`)
}

main().catch((err) => {
  console.error("Index failed:", err)
  process.exit(1)
})
