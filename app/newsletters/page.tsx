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
    <div className="pageWrap">
      <header className="pageHeader">
        <Link href="/" className="backLink">
          ← トップに戻る
        </Link>
        <h1 className="pageTitle">広報誌検索</h1>
        <p className="pageDesc">広報しんとくPDF全文検索（{entries.length}件インデックス済）</p>
      </header>

      <NewsletterSearch entries={entries} />
    </div>
  )
}