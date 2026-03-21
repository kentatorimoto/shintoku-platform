"use client"

import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { X, Search } from "lucide-react"

// ── 型定義 ─────────────────────────────────────────────────────────────────

interface GikaiSession {
  id: string
  officialTitle: string
  narrativeTitle?: string
  date: string
  tags: string[]
  summary?: {
    issues: string
    conflicts: string
    nextActions: string
  }
}

interface QnaSearchEntry {
  type: "qna" | "honkaigi"
  sessionId: string
  partIndex: number
  title: string
  speaker?: string
  tags: string[]
  billNumber?: string
}

interface GiketsuSession {
  sessionName: string
  items: {
    caseNumber: string
    title: string
    result: string
  }[]
}

interface SearchResult {
  category: "セッション" | "一般質問" | "議決"
  title: string
  subtitle: string
  href: string
}

// ── 検索ロジック ───────────────────────────────────────────────────────────

function parseTokens(raw: string): string[] {
  return raw.trim().split(/\s+/).filter((t) => t.length > 0)
}

function matchesAll(haystack: string, tokens: string[]): boolean {
  const lower = haystack.toLowerCase()
  return tokens.every((t) => lower.includes(t.toLowerCase()))
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
        <mark key={i} className="rounded px-0.5 bg-accent/20 text-textMain">
          {part}
        </mark>
      )
    }
    return part
  })
}

// ── データ検索 ─────────────────────────────────────────────────────────────

function searchSessions(sessions: GikaiSession[], tokens: string[]): SearchResult[] {
  return sessions
    .filter((s) => {
      const haystack = [
        s.officialTitle,
        s.narrativeTitle ?? "",
        s.tags.join(" "),
        s.summary?.issues ?? "",
        s.summary?.conflicts ?? "",
      ].join(" ")
      return matchesAll(haystack, tokens)
    })
    .slice(0, 5)
    .map((s) => ({
      category: "セッション" as const,
      title: s.narrativeTitle ?? s.officialTitle,
      subtitle: s.officialTitle,
      href: `/gikai/sessions/${s.id}`,
    }))
}

function searchQna(entries: QnaSearchEntry[], tokens: string[]): SearchResult[] {
  return entries
    .filter((e) => {
      const haystack = [e.title, e.speaker ?? "", e.tags.join(" "), e.billNumber ?? ""].join(" ")
      return matchesAll(haystack, tokens)
    })
    .slice(0, 5)
    .map((e) => ({
      category: "一般質問" as const,
      title: e.type === "honkaigi" ? `${e.billNumber} ${e.title}` : e.title,
      subtitle: e.type === "honkaigi" ? "本会議議案" : `${e.speaker ?? ""} — ${e.tags.join("・")}`,
      href: `/gikai/sessions/${e.sessionId}/${e.partIndex}`,
    }))
}

function searchGiketsu(sessions: GiketsuSession[], tokens: string[]): SearchResult[] {
  const results: SearchResult[] = []
  for (const session of sessions) {
    for (const item of session.items) {
      if (results.length >= 5) return results
      const haystack = `${item.caseNumber} ${item.title} ${session.sessionName}`
      if (matchesAll(haystack, tokens)) {
        results.push({
          category: "議決" as const,
          title: `${item.caseNumber} ${item.title}`,
          subtitle: `${session.sessionName} — ${item.result}`,
          href: `/gikai?q=${encodeURIComponent(item.title.slice(0, 30))}`,
        })
      }
    }
  }
  return results
}

// ── コンポーネント ─────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // データ（遅延ロード）
  const [sessions, setSessions] = useState<GikaiSession[]>([])
  const [qnaEntries, setQnaEntries] = useState<QnaSearchEntry[]>([])
  const [giketsuSessions, setGiketsuSessions] = useState<GiketsuSession[]>([])
  const [loading, setLoading] = useState(false)

  // モーダルが開いたらデータをフェッチ
  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      fetch("/data/gikai_sessions.json").then((r) => r.json()),
      fetch("/data/qna_search_index.json").then((r) => r.json()),
      fetch("/data/giketsu_index.json").then((r) => r.json()),
    ])
      .then(([s, q, g]) => {
        setSessions(s)
        setQnaEntries(q)
        setGiketsuSessions(g)
      })
      .catch((err) => console.error("Failed to load search data:", err))
      .finally(() => setLoading(false))
  }, [open])

  // モーダルが開いたらフォーカス
  useEffect(() => {
    if (open) {
      setQuery("")
      setDebouncedQuery("")
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // デバウンス
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(timer)
  }, [query])

  // ESC で閉じる
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // スクロール抑止
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  const tokens = useMemo(() => parseTokens(debouncedQuery), [debouncedQuery])

  const results: SearchResult[] = useMemo(() => {
    if (tokens.length === 0) return []
    const s = searchSessions(sessions, tokens)
    const q = searchQna(qnaEntries, tokens)
    const g = searchGiketsu(giketsuSessions, tokens)
    return [...s, ...q, ...g].slice(0, 10)
  }, [tokens, sessions, qnaEntries, giketsuSessions])

  const handleSelect = useCallback(
    (href: string) => {
      onClose()
      router.push(href)
    },
    [onClose, router],
  )

  if (!open) return null

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 z-[60] bg-base/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* パネル */}
      <div className="fixed inset-x-4 top-20 z-[61] mx-auto max-w-xl" ref={panelRef}>
        <div className="bg-ink border border-line rounded-2xl shadow-xl overflow-hidden">
          {/* 入力欄 */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
            <Search size={18} className="text-textSub shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="キーワードで検索（例：農業 補正予算）"
              className="flex-1 bg-transparent text-textMain placeholder:text-textSub/60 outline-none text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputMode="search"
            />
            <button
              onClick={onClose}
              className="text-textSub hover:text-textMain transition p-1"
              aria-label="閉じる"
            >
              <X size={18} />
            </button>
          </div>

          {/* 結果 */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="px-5 py-8 text-center text-textSub text-sm">
                データを読み込み中...
              </div>
            )}

            {!loading && tokens.length === 0 && (
              <div className="px-5 py-8 text-center text-textSub text-sm">
                セッション・一般質問・議決を横断検索
              </div>
            )}

            {!loading && tokens.length > 0 && results.length === 0 && (
              <div className="px-5 py-8 text-center text-textSub text-sm">
                「{debouncedQuery.trim()}」に一致する結果はありません
              </div>
            )}

            {!loading && results.length > 0 && (
              <ul className="py-2">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      onClick={() => handleSelect(r.href)}
                      className="w-full text-left px-5 py-3 hover:bg-accent/8 transition-colors"
                    >
                      <span className="inline-block text-[11px] font-medium text-accent bg-accent/10 rounded px-1.5 py-0.5 mr-2">
                        {r.category}
                      </span>
                      <span className="text-sm text-textMain">
                        {highlightTokens(r.title, tokens)}
                      </span>
                      <div className="mt-1 text-xs text-textSub truncate">
                        {highlightTokens(r.subtitle, tokens)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* フッター */}
          {!loading && tokens.length > 0 && results.length > 0 && (
            <div className="px-5 py-2.5 border-t border-line text-[11px] text-textSub">
              {results.length} 件表示（最大10件）
            </div>
          )}
        </div>
      </div>
    </>
  )
}
