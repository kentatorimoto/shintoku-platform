"use client"

import { useState, useEffect, useMemo, type ReactNode } from "react"

type PageEntry = {
  page: number
  text: string
}

type Entry = {
  title: string
  date: string
  url: string
  text?: string
  pages?: PageEntry[]
}

type MatchResult = {
  entry: Entry
  matchedPage: number | null
  snippet: string | null
}

function fullText(e: Entry): string {
  if (e.pages) return e.pages.map((p) => p.text).join(" ")
  return e.text ?? ""
}

function parseTokens(raw: string): string[] {
  return raw
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

function matchesAll(haystack: string, tokens: string[]): boolean {
  const lower = haystack.toLowerCase()
  return tokens.every((t) => lower.includes(t.toLowerCase()))
}

function findMatchedPage(entry: Entry, tokens: string[]): number | null {
  if (!entry.pages) return null
  for (const p of entry.pages) {
    if (matchesAll(p.text, tokens)) return p.page
  }
  // Fallback: find page matching at least one token
  for (const p of entry.pages) {
    const lower = p.text.toLowerCase()
    if (tokens.some((t) => lower.includes(t.toLowerCase()))) return p.page
  }
  return null
}

function extractSnippet(text: string, tokens: string[]): string | null {
  const normalized = text.replace(/\n/g, " ")
  const lower = normalized.toLowerCase()

  let earliest = -1
  for (const t of tokens) {
    const idx = lower.indexOf(t.toLowerCase())
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx
    }
  }
  if (earliest === -1) return null

  const start = Math.max(0, earliest - 60)
  const end = Math.min(normalized.length, start + 260)
  let snippet = normalized.slice(start, end)
  if (start > 0) snippet = "..." + snippet
  if (end < normalized.length) snippet = snippet + "..."
  return snippet
}

function highlightTokens(text: string, tokens: string[]): ReactNode[] {
  if (tokens.length === 0) return [text]

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const regex = new RegExp(`(${escaped.join("|")})`, "gi")

  const parts = text.split(regex)
  return parts.map((part, i) => {
    const isMatch = tokens.some((t) => part.toLowerCase() === t.toLowerCase())
    if (isMatch) {
      return (
        <mark
          key={i}
          className="rounded px-1 bg-accent/20 text-textMain"
        >
          {part}
        </mark>
      )
    }
    return part
  })
}

function pdfPageUrl(baseUrl: string, page: number): string {
  return `${baseUrl}#page=${page}`
}

export default function NewsletterSearch({ entries }: { entries: Entry[] }) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  const tokens = useMemo(() => parseTokens(debouncedQuery), [debouncedQuery])

  const display: MatchResult[] = useMemo(() => {
    if (tokens.length === 0) {
      return entries.slice(0, 20).map((e) => ({
        entry: e,
        matchedPage: null,
        snippet: null,
      }))
    }

    return entries
      .filter((e) => {
        const combined = e.title + " " + fullText(e)
        return matchesAll(combined, tokens)
      })
      .slice(0, 50)
      .map((e) => {
        const matchedPage = findMatchedPage(e, tokens)
        const searchText =
          matchedPage && e.pages
            ? e.pages.find((p) => p.page === matchedPage)?.text ?? ""
            : e.title + " " + fullText(e)

        return {
          entry: e,
          matchedPage,
          snippet: extractSnippet(searchText, tokens),
        }
      })
  }, [entries, tokens])

  const isSearching = tokens.length > 0

  return (
    <div className="space-y-6">
      {/* Search box */}
      <div className="space-y-3">
        <input
          placeholder="キーワード検索（例：農業 観光 子育て）"
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputMode="search"
        />

        <div className="text-sm text-textSub">
          {isSearching ? (
            display.length > 0 ? (
              <>
                「<span className="text-textMain">{debouncedQuery.trim()}</span>」の検索結果：{" "}
                <span className="text-textMain font-semibold">{display.length}</span> 件
              </>
            ) : (
              <>
                「<span className="text-textMain">{debouncedQuery.trim()}</span>」は見つかりませんでした。別のキーワードを試してください。
              </>
            )
          ) : (
            <>最新20件を表示</>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {display.map((r, i) => (
          <div key={i} className="card">
            <div className="text-xs text-textSub">{r.entry.date}</div>

            <div className="mt-2 text-lg md:text-xl font-semibold text-textMain">
              {isSearching ? highlightTokens(r.entry.title, tokens) : r.entry.title}
            </div>

            {r.snippet && (
              <p className="mt-3 text-sm text-textSub leading-relaxed">
                {r.matchedPage != null && (
                  <span className="text-accent mr-2">p.{r.matchedPage}</span>
                )}
                {highlightTokens(r.snippet, tokens)}
              </p>
            )}

            <div className="mt-4">
              <a
                href={
                  isSearching && r.matchedPage != null
                    ? pdfPageUrl(r.entry.url, r.matchedPage)
                    : r.entry.url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-accent hover:text-textMain transition"
              >
                {isSearching && r.matchedPage != null ? "PDFで開く（該当ページ）" : "PDFを見る"}
                <span aria-hidden>→</span>
              </a>
            </div>
          </div>
        ))}

        {isSearching && display.length === 0 && (
          <div className="card">
            <p className="text-textSub">
              「<span className="text-textMain">{debouncedQuery.trim()}</span>」は見つかりませんでした。別のキーワードを試してください。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}