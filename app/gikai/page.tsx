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
  items: GiketsuItem[]
}

interface FlatItem extends GiketsuItem {
  sessionName: string
  sessionRange: string
  eraLabel: string
  year: number
  pdfUrl: string
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

  useEffect(() => {
    fetch("/data/giketsu_index.json")
      .then((r) => r.json())
      .then((data: GiketsuSession[]) => setSessions(data))
      .catch(console.error)
      .finally(() => setLoading(false))
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
  const latestRef = useRef({ year, type, result })
  useEffect(() => {
    latestRef.current = { year, type, result }
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /** q / year / type / result を URL に書き込む（limit はリセット） */
  function commitQuery(value: string) {
    const { year, type, result } = latestRef.current
    const params = new URLSearchParams()
    if (value) params.set("q", value)
    if (year) params.set("year", year)
    if (type) params.set("type", type)
    if (result) params.set("result", result)
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
      if (type && item.caseType !== type) return false
      if (result === "その他") {
        if (RESULT_ORDER.includes(item.result)) return false
      } else if (result) {
        if (item.result !== result) return false
      }
      return true
    })
  }, [flatItems, q, year, type, result])

  const visibleItems = filteredItems.slice(0, limit)
  const hasMore = visibleItems.length < filteredItems.length
  const hasFilter = !!(q || year || type || result)
  const isPending = inputValue !== q

  // ── JSX ──────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      {/* ── ヘッダー ─────────────────────────────────────── */}
      <div className="mb-10">
        <Link
          href="/"
          className="text-textSub text-sm hover:text-textMain transition-colors mb-4 inline-block"
        >
          ← トップ
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
          議会（議決結果）
        </h1>
        <p className="text-textMain/70 text-lg">
          議決結果（議案・意見案）の検索・閲覧
        </p>
      </div>

      {/* ── 直近セッション（top 3） ───────────────────────── */}
      {!loading && activeSessions.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-textSub uppercase tracking-widest mb-3">
            最近の会議
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {activeSessions.slice(0, 3).map((session) => (
              <button
                key={session.sessionName}
                onClick={() =>
                  setYear(year === session.eraLabel ? "" : session.eraLabel)
                }
                className={`text-left bg-ink border rounded-xl p-4 transition-all ${
                  year === session.eraLabel
                    ? "border-accent"
                    : "border-line hover:border-accent/50"
                }`}
              >
                <div className="text-accent text-xs font-semibold mb-0.5">
                  {session.eraLabel}
                </div>
                <div className="text-textMain font-semibold text-sm">
                  {session.sessionLabel}
                </div>
                {session.sessionRange && (
                  <div className="text-textSub text-xs mt-1">
                    {session.sessionRange}
                  </div>
                )}
                <div className="text-textSub text-xs mt-2">
                  {session.items.length} 件
                </div>
              </button>
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

          {/* 種別チップ */}
          {(["議案", "意見案"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                type === t
                  ? "bg-accent text-base border-accent"
                  : "bg-ink border-line text-textSub hover:border-accent/50"
              }`}
            >
              {t}
            </button>
          ))}

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
        {loading ? "読み込み中…" : `${filteredItems.length.toLocaleString()} 件`}
      </p>

      {/* ── リスト ───────────────────────────────────────── */}
      {loading ? (
        <Skeleton />
      ) : filteredItems.length === 0 ? (
        <div className="text-center text-textSub py-20">
          該当する議案がありません
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {visibleItems.map((item, i) => (
              <a
                key={i}
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
                      className={`text-sm leading-snug line-clamp-2 transition-colors ${
                        item.title
                          ? "text-textMain group-hover:text-accent/90"
                          : "text-textSub italic"
                      }`}
                    >
                      {item.title || "（件名なし）"}
                    </p>
                    <p className="text-textSub text-xs mt-1.5">
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
            ))}
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
