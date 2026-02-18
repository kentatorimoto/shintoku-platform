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
  // Fallback: find page matching at least the first token
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

  const escaped = tokens.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  )
  const regex = new RegExp(`(${escaped.join("|")})`, "gi")

  const parts = text.split(regex)
  return parts.map((part, i) => {
    const isMatch = tokens.some(
      (t) => part.toLowerCase() === t.toLowerCase()
    )
    if (isMatch) {
      return (
        <mark key={i} className="bg-green-400 text-black px-1">
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
        const searchText = matchedPage && e.pages
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
    <div>
      <input
        placeholder="キーワード検索（例：農業 観光 子育て）"
        className="w-full p-3 bg-black border border-green-400 text-green-400 placeholder-green-700 mb-4"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="text-green-400 text-sm mb-6">
        {isSearching
          ? display.length > 0
            ? `${display.length} results for "${debouncedQuery.trim()}"`
            : `No results for "${debouncedQuery.trim()}". Try different keywords.`
          : "Showing latest 20 newsletters"}
      </div>

      <div className="space-y-4">
        {display.map((r, i) => (
          <div
            key={i}
            className="border border-green-400 p-4 hover:bg-green-950 transition-colors"
          >
            <div className="text-green-600 text-sm">{r.entry.date}</div>
            <div className="text-xl mt-1 mb-2">
              {isSearching
                ? highlightTokens(r.entry.title, tokens)
                : r.entry.title}
            </div>

            {r.snippet && (
              <p className="text-green-600 text-sm mb-2 leading-relaxed">
                {r.matchedPage != null && (
                  <span className="text-green-500 mr-1">[p.{r.matchedPage}]</span>
                )}
                {highlightTokens(r.snippet, tokens)}
              </p>
            )}

            <a
              href={
                isSearching && r.matchedPage != null
                  ? pdfPageUrl(r.entry.url, r.matchedPage)
                  : r.entry.url
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 hover:text-green-300 underline text-sm"
            >
              {isSearching && r.matchedPage != null
                ? "PDFで開く（該当ページ） →"
                : "PDFを見る →"}
            </a>
          </div>
        ))}

        {isSearching && display.length === 0 && (
          <div className="border border-green-400 p-8 text-center">
            <p className="text-green-400">
              No results for &quot;{debouncedQuery.trim()}&quot;. Try different
              keywords.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
