import fs from "fs"
import path from "path"
import Link from "next/link"
import NewsletterSearch from "@/components/NewsletterSearch"

function loadIndex() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "newsletters_index.json")
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"))
    }
  } catch (error) {
    console.error("Failed to load newsletters index:", error)
  }
  return []
}

export default function Page() {
  const entries = loadIndex()

  return (
    <main className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <Link href="/" className="text-green-600 hover:text-green-400 mb-4 inline-block">
            ← トップに戻る
          </Link>
          <h1 className="text-4xl mb-2">$ Newsletter Search</h1>
          <p className="text-green-600">
            広報しんとくPDF全文検索 | {entries.length}件インデックス済
          </p>
        </header>

        <NewsletterSearch entries={entries} />
      </div>
    </main>
  )
}