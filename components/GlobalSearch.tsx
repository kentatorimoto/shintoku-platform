"use client"

import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { X, Search } from "lucide-react"
import { SEARCH_CATEGORIES, SEARCH_SCOPE_TEXT, type SearchCategory } from "@/lib/labels"
import type { ShisekiData, ShisekiItem } from "@/scripts/lib/schema"

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

interface NewsletterPage {
  page: number
  text: string
}

interface NewsletterEntry {
  title: string
  date:  string
  url:   string
  pages: NewsletterPage[]
}

interface Announcement {
  title:    string
  date:     string
  category: string
  url:      string
}

interface SearchResult {
  category: SearchCategory
  title: string
  subtitle: string
  href: string
  /** 町サイト・PDFなど、サイト外へ出るリンク */
  external?: boolean
}

/** 1回に出す最大件数。カテゴリごとに最大5件を集めてから、この数で頭打ちにする。 */
const MAX_RESULTS = 14

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
        <mark key={i} className="rounded-[2px] px-0.5 bg-accent/20 text-textMain">
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
      category: SEARCH_CATEGORIES.session,
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
      category: SEARCH_CATEGORIES.qna,
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
          category: SEARCH_CATEGORIES.giketsu,
          title: `${item.caseNumber} ${item.title}`,
          subtitle: `${session.sessionName} — ${item.result}`,
          href: `/gikai?q=${encodeURIComponent(item.title.slice(0, 30))}`,
        })
      }
    }
  }
  return results
}

/**
 * 史跡は「概要どまり」で検索する。`shiseki.json` には本文が入っていないので、
 * ここを広げても原本の全文が検索対象になることはない（権利ガードレール4）。
 */
function searchShiseki(items: ShisekiItem[], tokens: string[]): SearchResult[] {
  return items
    .filter((item) => {
      const haystack = [
        item.title,
        item.summary ?? "",
        item.location ?? "",
        item.era ?? "",
        item.entities.join(" "),
      ].join(" ")
      return matchesAll(haystack, tokens)
    })
    // 「狩勝」で「旧狩勝トンネル」が掲載順の都合で溢れないよう、史跡名に当たったものを先に出す
    .sort((a, b) => Number(matchesAll(b.title, tokens)) - Number(matchesAll(a.title, tokens)))
    .slice(0, 5)
    .map((item) => ({
      category: SEARCH_CATEGORIES.shiseki,
      title: item.title,
      subtitle: [item.location, item.era, `原本 p.${item.page_start}`]
        .filter((s) => s)
        .join(" — "),
      href: `/shiseki/${item.id}`,
    }))
}

/** 一致した箇所の前後を切り出す。広報は本文が長いので、当たった場所を見せないと選べない。 */
function extractSnippet(text: string, tokens: string[], width = 28): string {
  const lower = text.toLowerCase()
  let at = -1
  for (const t of tokens) {
    const i = lower.indexOf(t.toLowerCase())
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) return text.slice(0, width * 2)
  const start = Math.max(0, at - width)
  const end = Math.min(text.length, at + width * 2)
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "")
}

/**
 * 広報しんとくはページ単位で当てる（号単位だと、どこに書いてあるか分からない）。
 * リンクはPDFの該当ページへ直接飛ばす。
 */
function searchNewsletters(entries: NewsletterEntry[], tokens: string[]): SearchResult[] {
  const results: SearchResult[] = []
  for (const entry of entries) {
    for (const page of entry.pages) {
      if (results.length >= 5) return results
      if (!matchesAll(page.text, tokens)) continue
      results.push({
        category: SEARCH_CATEGORIES.newsletter,
        title: `${entry.title} p.${page.page}`,
        subtitle: extractSnippet(page.text, tokens),
        href: `${entry.url}#page=${page.page}`,
        external: true,
      })
      break // 1号につき1件（同じ号で何ページも埋めない）
    }
  }
  return results
}

/** お知らせは町サイトの原文へ送る。ATLAS 側に本文は持っていない。 */
function searchAnnouncements(items: Announcement[], tokens: string[]): SearchResult[] {
  return items
    .filter((a) => matchesAll(`${a.title} ${a.category} ${a.date}`, tokens))
    .slice(0, 5)
    .map((a) => ({
      category: SEARCH_CATEGORIES.announcement,
      title: a.title,
      subtitle: [a.date, a.category].filter(Boolean).join(" — ") + "（新得町公式サイト）",
      href: a.url,
      external: true,
    }))
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
  const [shiseki, setShiseki] = useState<ShisekiItem[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)

  // 広報しんとくの全文は約3MBある。開いただけで取りに行かず、実際に検索したときだけ読む。
  const [newsletters, setNewsletters] = useState<NewsletterEntry[]>([])
  const [newslettersFailed, setNewslettersFailed] = useState(false)
  const newslettersRequested = useRef(false)

  // モーダルが開いたらデータをフェッチ
  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      fetch("/data/gikai_sessions.json").then((r) => r.json()),
      fetch("/data/qna_search_index.json").then((r) => r.json()),
      fetch("/data/giketsu_index.json").then((r) => r.json()),
      // 史跡はメタと概要だけのファイル（本文は入っていない）
      fetch("/data/archive/shiseki.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/data/announcements.json")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([s, q, g, a, n]) => {
        setSessions(s)
        setQnaEntries(q)
        setGiketsuSessions(g)
        setShiseki((a as ShisekiData | null)?.items ?? [])
        setAnnouncements(n as Announcement[])
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

  // 最初に検索語が入った時点で広報を取りに行く。以後はブラウザのキャッシュに任せる。
  useEffect(() => {
    if (tokens.length === 0 || newslettersRequested.current) return
    // 読み込み中フラグは持たない（effect 内の同期 setState は cascading render を招く）。
    // 「まだ届いていない」は newsletters が空かどうかで分かる。
    newslettersRequested.current = true
    fetch("/data/newsletters_index.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setNewsletters(data as NewsletterEntry[]))
      .catch((err) => {
        console.error("Failed to load newsletters:", err)
        setNewslettersFailed(true)
      })
  }, [tokens])

  /** 広報が届くまでの間だけ真になる。届けば newsletters が埋まり、失敗すればフラグで止まる。 */
  const newslettersPending =
    tokens.length > 0 && newsletters.length === 0 && !newslettersFailed

  const results: SearchResult[] = useMemo(() => {
    if (tokens.length === 0) return []
    const s = searchSessions(sessions, tokens)
    const q = searchQna(qnaEntries, tokens)
    const g = searchGiketsu(giketsuSessions, tokens)
    const a = searchShiseki(shiseki, tokens)
    const n = searchNewsletters(newsletters, tokens)
    const o = searchAnnouncements(announcements, tokens)
    return [...s, ...q, ...g, ...a, ...n, ...o].slice(0, MAX_RESULTS)
  }, [tokens, sessions, qnaEntries, giketsuSessions, shiseki, newsletters, announcements])

  const handleSelect = useCallback(
    (href: string, external?: boolean) => {
      onClose()
      // 広報PDF・町サイトのお知らせはサイト外。別タブで開く
      if (external) window.open(href, "_blank", "noopener,noreferrer")
      else router.push(href)
    },
    [onClose, router],
  )

  if (!open) return null

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 z-[60] bg-paper/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* パネル */}
      <div className="fixed inset-x-4 top-20 z-[61] mx-auto max-w-xl" ref={panelRef}>
        <div className="bg-ink border border-line rounded-[3px] shadow-xl overflow-hidden">
          {/* 入力欄 */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
            <Search size={18} className="text-textMuted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="キーワードで検索（例：農業 補正予算）"
              className="flex-1 bg-transparent text-textMain placeholder:text-textMuted outline-none text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputMode="search"
            />
            <button
              onClick={onClose}
              className="text-textMuted hover:text-textMain transition p-1"
              aria-label="閉じる"
            >
              <X size={18} />
            </button>
          </div>

          {/* 結果 */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading && (
              <div className="px-5 py-8 text-center text-textMuted text-sm">
                データを読み込み中...
              </div>
            )}

            {!loading && tokens.length === 0 && (
              <div className="px-5 py-8 text-center text-textMuted text-sm">
                {SEARCH_SCOPE_TEXT}
              </div>
            )}

            {!loading && tokens.length > 0 && results.length === 0 && !newslettersPending && (
              <div className="px-5 py-8 text-center text-textMuted text-sm">
                「{debouncedQuery.trim()}」に一致する結果はありません
              </div>
            )}

            {!loading && tokens.length > 0 && newslettersPending && (
              <div className="px-5 py-3 text-center text-textMuted text-xs border-b border-line">
                {SEARCH_CATEGORIES.newsletter}の全文を読み込み中…
              </div>
            )}

            {!loading && results.length > 0 && (
              <ul className="py-2">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      onClick={() => handleSelect(r.href, r.external)}
                      className="w-full text-left px-5 py-3 hover:bg-accent/8 transition-colors"
                    >
                      <span className="inline-block text-[11px] font-medium text-accent bg-hover rounded-[2px] px-1.5 py-0.5 mr-2">
                        {r.category}
                      </span>
                      <span className="text-sm text-textMain">
                        {highlightTokens(r.title, tokens)}
                      </span>
                      <div className="mt-1 text-xs text-textMuted truncate">
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
            <div className="px-5 py-2.5 border-t border-line text-[11px] text-textMuted">
              {results.length} 件表示（最大{MAX_RESULTS}件）
            </div>
          )}
        </div>
      </div>
    </>
  )
}
