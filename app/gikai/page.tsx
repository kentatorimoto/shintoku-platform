"use client"

import { useState, useEffect, useRef, useMemo, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

// ─────────────────────────── Types ────────────────────────────────

interface GiketsuItem {
  caseNumber: string
  caseType: string
  num: number
  title: string
  decisionDate: string
  result: string
}

interface GiketsuSession {
  pdfUrl: string
  year: number
  eraLabel: string
  sessionLabel: string
  sessionName: string
  sessionRange: string
  sessionId: string | null
  items: GiketsuItem[]
}

interface FlatItem extends GiketsuItem {
  sessionName: string
  sessionRange: string
  eraLabel: string
  year: number
  pdfUrl: string
}

type GikaiLinks = Record<string, string[]>

// ─────────────────────────── Label maps ───────────────────────────

const THEME_LABELS: Record<string, string> = {
  agriculture: "農業・産業",
  tourism: "観光",
  health: "健康・福祉",
  community: "地域・参加",
  finance: "財政",
}

const ISSUE_LABELS: Record<string, string> = {
  "agri-conservative-target": "農業は年1%成長で町を支え続けられるか？",
  "agri-fewer-farms": "農家戸数が減っても農業総額を維持できるか？",
  "agri-climate": "気候変動で作物転換は必要になるか？",
  "agri-smart": "技術で農業の労働力不足は補えるか？",
  "tourism-satisfaction": "なぜ町民は観光の成果に満足していないのか？",
  "tourism-org-reform": "新得町に新しい観光組織は必要か？",
  "tourism-residents": "なぜ町民は観光の魅力を実感できていないのか？",
  "finance-post-project": "大型事業後の借金をどうコントロールするか？",
  "finance-kpi": "財政の\u201c安全運転ライン\u201dは何か？",
  "finance-slack": "財政の\u201c余力\u201dをどう確保するか？",
}

// ─────────────────────────── Helpers ──────────────────────────────

function resultStyle(result: string): string {
  switch (result) {
    case "原案可決":
      return "bg-accent/15 text-accent"
    case "修正可決":
      return "bg-amber-400/15 text-amber-400"
    case "否決":
      return "bg-red-400/15 text-red-400"
    case "継続審査":
      return "bg-sky-400/15 text-sky-400"
    default:
      return "bg-line text-textSub"
  }
}

const RESULT_ORDER = ["原案可決", "修正可決", "否決", "継続審査"]

/** 凡例ドット色（Tailwind クラス） */
const RESULT_DOT: Record<string, string> = {
  "原案可決": "bg-accent",
  "修正可決": "bg-amber-400",
  "否決":     "bg-red-400",
  "継続審査": "bg-sky-400",
}

const PAGE_SIZE = 100

// ─────────────────────────── Skeleton ─────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-ink border border-line rounded-xl p-4 h-[72px] animate-pulse"
        />
      ))}
    </div>
  )
}

// ─────────────────────────── Content (useSearchParams 使用) ────────

function GikaiPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // ── URL からフィルタ値を読み取る ──────────────────────────────
  const q = searchParams.get("q") ?? ""
  const year = searchParams.get("year") ?? ""
  const type = searchParams.get("type") ?? ""
  const result = searchParams.get("result") ?? ""
  const theme = searchParams.get("theme") ?? ""
  const issue = searchParams.get("issue") ?? ""
  const session = searchParams.get("session") ?? ""
  const limit = Math.max(
    PAGE_SIZE,
    Number(searchParams.get("limit") || PAGE_SIZE)
  )

  // テキスト入力だけ即時レスポンス用のローカル state を持つ
  const [inputValue, setInputValue] = useState(q)

  // ブラウザ戻る/進む で q が変わったら input も同期
  useEffect(() => {
    setInputValue(q)
  }, [q])

  // ── データ取得 ───────────────────────────────────────────────
  const [sessions, setSessions] = useState<GiketsuSession[]>([])
  const [loading, setLoading] = useState(true)
  const [links, setLinks] = useState<GikaiLinks>({})
  const [linksLoaded, setLinksLoaded] = useState(false)

  useEffect(() => {
    fetch("/data/giketsu_index.json")
      .then((r) => r.json())
      .then((data: GiketsuSession[]) => setSessions(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch("/data/gikai_links.json")
      .then((r) => r.json())
      .then((data: GikaiLinks) => setLinks(data))
      .catch(() => {})
      .finally(() => setLinksLoaded(true))
  }, [])

  // ── URL 更新ヘルパー ─────────────────────────────────────────
  /**
   * updates のキーを上書き/削除して router.replace する。
   * 値が "" のキーは URL から削除する。
   */
  function pushParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // ── テキスト入力のデバウンス（400 ms）→ URL 更新 ───────────
  // ref に最新フィルタ値を持ち、stale closure を回避する
  const latestRef = useRef({ year, type, result, theme, issue, session })
  useEffect(() => {
    latestRef.current = { year, type, result, theme, issue, session }
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  /** q / year / type / result / theme / issue を URL に書き込む（limit はリセット） */
  function commitQuery(value: string) {
    const { year, type, result, theme, issue, session } = latestRef.current
    const params = new URLSearchParams()
    if (value) params.set("q", value)
    if (year) params.set("year", year)
    if (type) params.set("type", type)
    if (result) params.set("result", result)
    if (theme) params.set("theme", theme)
    if (issue) params.set("issue", issue)
    if (session) params.set("session", session)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function handleInputChange(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => commitQuery(value), 400)
  }

  function handleClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setInputValue("")
    commitQuery("")
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    commitQuery(inputValue)
    inputRef.current?.blur()
  }

  // ── フィルタ操作（即時 URL 更新）──────────────────────────────
  function setYear(val: string) {
    pushParams({ year: val, limit: "" })
  }
  function setType(val: string) {
    pushParams({ type: type === val ? "" : val, limit: "" })
  }
  function setResult(val: string) {
    pushParams({ result: result === val ? "" : val, limit: "" })
  }
  function loadMore() {
    pushParams({ limit: String(limit + PAGE_SIZE) })
  }
  function resetFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setInputValue("")
    router.replace(pathname, { scroll: false })
  }

  // ── 派生データ ───────────────────────────────────────────────
  const activeSessions = useMemo(
    () => sessions.filter((s) => s.items.length > 0),
    [sessions]
  )

  const flatItems = useMemo<FlatItem[]>(
    () =>
      sessions.flatMap((s) =>
        s.items.map((item) => ({
          ...item,
          sessionName: s.sessionName,
          sessionRange: s.sessionRange,
          eraLabel: s.eraLabel,
          year: s.year,
          pdfUrl: s.pdfUrl,
        }))
      ),
    [sessions]
  )

  const eraLabels = useMemo(
    () => [...new Set(activeSessions.map((s) => s.eraLabel))],
    [activeSessions]
  )

  const resultTypes = useMemo(() => {
    const inData = new Set(flatItems.map((i) => i.result).filter(Boolean))
    const known = RESULT_ORDER.filter((r) => inData.has(r))
    const hasOther = [...inData].some((r) => !RESULT_ORDER.includes(r))
    return hasOther ? [...known, "その他"] : known
  }, [flatItems])

  const filteredItems = useMemo<FlatItem[]>(() => {
    return flatItems.filter((item) => {
      if (
        q &&
        !item.title.includes(q) &&
        !item.caseNumber.includes(q) &&
        !item.sessionName.includes(q)
      )
        return false
      if (year && item.eraLabel !== year) return false
      if (session && item.sessionName !== session) return false
      if (type && item.caseType !== type) return false
      if (result === "その他") {
        if (RESULT_ORDER.includes(item.result)) return false
      } else if (result) {
        if (item.result !== result) return false
      }
      if (theme || issue) {
        const key = `${item.eraLabel}-${item.caseType}-${item.num}`
        const refs = links[key] ?? []
        if (theme && !refs.includes(`theme:${theme}`)) return false
        if (issue && !refs.includes(`issue:${issue}`)) return false
      }
      return true
    }).sort((a, b) => b.year - a.year)
  }, [flatItems, q, year, session, type, result, theme, issue, links])

  const visibleItems = filteredItems.slice(0, limit)
  const hasMore = visibleItems.length < filteredItems.length
  const hasFilter = !!(q || year || session || type || result || theme || issue)
  const isPending = inputValue !== q
  const waitingLinks = !!(theme || issue) && !linksLoaded

  // ── JSX ──────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20 text-base md:text-lg">
      {/* ── ヘッダー ─────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="!text-4xl md:!text-5xl font-bold tracking-tight mb-4 text-textMain">
          町の決定を読む
        </h1>
        <p className="text-textMain/70 text-lg">
          何が決まり、何が見送られたか
        </p>
        <Link href="/gikai/sessions" className="text-sm text-accent hover:text-accent/80 transition-colors mt-2 inline-block">
          議会を読む →
        </Link>
      </div>

      {/* ── 直近セッション（top 3） ───────────────────────── */}
      {!loading && activeSessions.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-textSub tracking-widest mb-3">
  最近の会議
</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {activeSessions.slice(0, 3).map((session) => (
              <div
                key={session.sessionName}
                onClick={() =>
                  setYear(year === session.eraLabel ? "" : session.eraLabel)
                }
                role="button"
                className={`cursor-pointer text-left bg-ink border rounded-xl p-4 transition-all ${
                  year === session.eraLabel
                    ? "border-accent"
                    : "border-line hover:border-accent/50"
                }`}
              >
                <div className="text-accent text-xs font-semibold mb-0.5">
                  {session.eraLabel}
                </div>
                <div className="text-textMain font-semibold text-base">
                  {session.sessionLabel}
                </div>
                {session.sessionRange && (
                  <div className="text-textSub text-sm mt-1">
                    {session.sessionRange}
                  </div>
                )}
                <div className="text-textSub text-sm mt-2">
                  {session.items.length} 件
                </div>
                {session.sessionId && (
                  <Link
                    href={`/gikai/sessions/${session.sessionId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block mt-3 text-xs text-accent hover:text-accent/70 transition-colors"
                  >
                    論点・争点を読む →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 検索・フィルタ ─────────────────────────────────── */}
      <section className="mb-6 space-y-3">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            enterKeyHint="search"
            placeholder="件名・議案番号・会議名で検索…"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ fontSize: "16px" }}
            className="w-full bg-ink border border-line rounded-xl px-4 py-3 pr-10 text-textMain placeholder-textSub/60 focus:outline-none focus:border-accent transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {inputValue ? (
              <button
                type="button"
                onClick={handleClear}
                aria-label="検索をクリア"
                className="text-textSub hover:text-textMain transition-colors p-1 leading-none"
              >
                ×
              </button>
            ) : isPending ? (
              <span className="text-textSub text-sm select-none" aria-hidden="true">…</span>
            ) : null}
          </div>
        </div>

        {/* ── Active Filters ──────────────────────────────── */}
        {hasFilter && (
          <div className="flex flex-wrap gap-2 items-center">
            {q && (
              <span className="inline-flex items-center gap-2 bg-ink border border-line text-textMain rounded-full px-3 py-1.5 text-sm">
                検索：{q}
                <button
                  onClick={() => {
                    if (debounceRef.current) clearTimeout(debounceRef.current)
                    setInputValue("")
                    pushParams({ q: "", limit: "" })
                  }}
                  aria-label="検索条件を解除"
                  className="text-textSub hover:text-textMain transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            )}
            {year && (
              <span className="inline-flex items-center gap-2 bg-ink border border-line text-textMain rounded-full px-3 py-1.5 text-sm">
                {year}
                <button
                  onClick={() => pushParams({ year: "", limit: "" })}
                  aria-label="年度フィルタを解除"
                  className="text-textSub hover:text-textMain transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            )}
            {type && (
              <span className="inline-flex items-center gap-2 bg-ink border border-line text-textMain rounded-full px-3 py-1.5 text-sm">
                {type}
                <button
                  onClick={() => pushParams({ type: "", limit: "" })}
                  aria-label="種別フィルタを解除"
                  className="text-textSub hover:text-textMain transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            )}
            {result && (
              <span className="inline-flex items-center gap-2 bg-ink border border-line text-textMain rounded-full px-3 py-1.5 text-sm">
                {result}
                <button
                  onClick={() => pushParams({ result: "", limit: "" })}
                  aria-label="結果フィルタを解除"
                  className="text-textSub hover:text-textMain transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            )}
            {theme && (
              <span className="inline-flex items-center gap-2 bg-ink border border-line text-textMain rounded-full px-3 py-1.5 text-sm">
                テーマ：{THEME_LABELS[theme] ?? theme}
                <button
                  onClick={() => pushParams({ theme: "", limit: "" })}
                  aria-label="テーマフィルタを解除"
                  className="text-textSub hover:text-textMain transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            )}
            {issue && (
              <span className="inline-flex items-center gap-2 bg-ink border border-line text-textMain rounded-full px-3 py-1.5 text-sm">
                論点：{ISSUE_LABELS[issue] ?? issue}
                <button
                  onClick={() => pushParams({ issue: "", limit: "" })}
                  aria-label="論点フィルタを解除"
                  className="text-textSub hover:text-textMain transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-textSub underline hover:text-textMain text-sm py-1.5 transition-colors"
            >
              すべてリセット
            </button>
          </div>
        )}

        {/* ── フィルタ操作行 ──────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* 年度セレクト */}
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="bg-ink border border-line text-textSub rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
          >
            <option value="">年度：すべて</option>
            {eraLabels.map((era) => (
              <option key={era} value={era}>
                {era}
              </option>
            ))}
          </select>

          {/* 結果チップ */}
          {resultTypes.map((r) => (
            <button
              key={r}
              onClick={() => setResult(r)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                result === r
                  ? "bg-accent text-base border-accent"
                  : "bg-ink border-line text-textSub hover:border-accent/50"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* ── 凡例 ─────────────────────────────────────── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-textSub pt-1">
          {RESULT_ORDER.map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${RESULT_DOT[r]}`} />
              {r}
            </span>
          ))}
        </div>
      </section>

      {/* ── 件数 ─────────────────────────────────────────── */}
      <p className="text-textSub text-sm mb-4">
        {loading || waitingLinks ? "読み込み中…" : `${filteredItems.length.toLocaleString()} 件`}
      </p>

      {/* ── リスト ───────────────────────────────────────── */}
      {loading || waitingLinks ? (
        <Skeleton />
      ) : filteredItems.length === 0 ? (
        <div className="text-center text-textSub py-20">
          該当する議案がありません
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {visibleItems.map((item, i) => {
              const caseKey = `${item.eraLabel}-${item.caseType}-${item.num}`
              const refs = links[caseKey] ?? []
              return (
                <div key={i}>
                  <a
                    href={item.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-ink border border-line rounded-xl p-4 hover:border-accent transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      {/* 左：種別+番号 */}
                      <div className="shrink-0 pt-0.5">
                        <span className="inline-flex items-baseline gap-1 text-xs font-mono bg-line rounded px-2 py-1 text-textSub">
                          {item.caseType}
                          <span className="text-textMain font-semibold">
                            {item.num}
                          </span>
                        </span>
                      </div>

                      {/* 中：件名 + メタ */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-base md:text-lg line-clamp-2 transition-colors ${
                            item.title
                              ? "text-textMain group-hover:text-accent/90"
                              : "text-textSub italic"
                          }`}
                        >
                          {item.title || "（件名なし）"}
                        </p>
                        <p className="text-textSub text-sm mt-1.5">
                          {item.decisionDate}
                          <span className="mx-1.5 opacity-40">·</span>
                          {item.sessionName}
                        </p>
                      </div>

                      {/* 右：結果バッジ */}
                      <div className="shrink-0">
                        <span
                          className={`inline-block text-xs font-medium rounded-md px-2 py-0.5 whitespace-nowrap ${resultStyle(item.result)}`}
                        >
                          {item.result || "—"}
                        </span>
                      </div>
                    </div>
                  </a>
                  {refs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
                      <span className="text-xs text-textSub shrink-0">関連：</span>
                      {refs.map((ref) => {
                        const sep = ref.indexOf(":")
                        const kind = ref.slice(0, sep)
                        const id = ref.slice(sep + 1)
                        const label =
                          kind === "theme"
                            ? (THEME_LABELS[id] ?? id)
                            : (ISSUE_LABELS[id] ?? id)
                        const href =
                          kind === "theme"
                            ? `/process?theme=${id}`
                            : `/process/issues?issue=${id}`
                        return (
                          <Link
                            key={ref}
                            href={href}
                            className="inline-flex items-center text-xs border border-line bg-ink rounded px-2 py-0.5 text-textSub hover:text-accent hover:border-accent transition-colors"
                          >
                            {label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* もっと見る */}
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                className="px-6 py-3 border border-line rounded-xl text-textSub hover:border-accent hover:text-textMain transition-colors text-sm"
              >
                さらに表示（残り{" "}
                {(filteredItems.length - visibleItems.length).toLocaleString()}{" "}
                件）
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────── Page export ──────────────────────────
// useSearchParams は Suspense バウンダリが必要

export default function GikaiPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Skeleton />
        </div>
      }
    >
      <GikaiPageContent />
    </Suspense>
  )
}
