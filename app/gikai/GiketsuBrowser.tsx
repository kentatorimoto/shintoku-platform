"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { LABELS, INSIGHT_THEME_LABELS } from "@/lib/labels"
import GiketsuRow from "./GiketsuRow"
import {
  ISSUE_LABELS, PAGE_SIZE, RESULT_DOT, RESULT_ORDER, flattenItems, linkKey,
  type FlatItem, type GikaiLinks, type GiketsuSession,
} from "./types"

interface Props {
  sessions: GiketsuSession[]
  links:    GikaiLinks
}

/**
 * 議決一覧の絞り込みと検索。
 *
 * データは props で受け取る。以前はここで giketsu_index.json（167KB）と
 * gikai_links.json を実行時に fetch していたが、どちらもビルド時に読める静的JSONなので
 * サーバー側で埋め込むようにした。実行時のリクエストは0本。
 *
 * useSearchParams() を使うので Suspense 境界が要る。そのフォールバックには
 * GiketsuStatic（本物の先頭100件）を置いてあるので、ハイドレーション前でも記録は読める。
 */
export default function GiketsuBrowser({ sessions, links }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // ── URL からフィルタ値を読み取る ──────────────────────────────
  const q       = searchParams.get("q") ?? ""
  const year    = searchParams.get("year") ?? ""
  const type    = searchParams.get("type") ?? ""
  const result  = searchParams.get("result") ?? ""
  const theme   = searchParams.get("theme") ?? ""
  const issue   = searchParams.get("issue") ?? ""
  const session = searchParams.get("session") ?? ""
  const limit   = Math.max(PAGE_SIZE, Number(searchParams.get("limit") || PAGE_SIZE))

  // テキスト入力だけ即時レスポンス用のローカル state を持つ
  const [inputValue, setInputValue] = useState(q)

  // ブラウザ戻る/進む で q が変わったら input も同期
  useEffect(() => { setInputValue(q) }, [q])

  /** updates のキーを上書き/削除して router.replace する。値が "" のキーは削除。 */
  function pushParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // ── テキスト入力のデバウンス（400ms）→ URL 更新 ───────────
  // ref に最新フィルタ値を持ち、stale closure を回避する
  const latestRef = useRef({ year, type, result, theme, issue, session })
  useEffect(() => { latestRef.current = { year, type, result, theme, issue, session } })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  function commitQuery(value: string) {
    const { year, type, result, theme, issue, session } = latestRef.current
    const params = new URLSearchParams()
    if (value)   params.set("q", value)
    if (year)    params.set("year", year)
    if (type)    params.set("type", type)
    if (result)  params.set("result", result)
    if (theme)   params.set("theme", theme)
    if (issue)   params.set("issue", issue)
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
  const setYear   = (val: string) => pushParams({ year: val, limit: "" })
  const setResult = (val: string) => pushParams({ result: result === val ? "" : val, limit: "" })
  const loadMore  = () => pushParams({ limit: String(limit + PAGE_SIZE) })

  function resetFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setInputValue("")
    router.replace(pathname, { scroll: false })
  }

  // ── 派生データ ───────────────────────────────────────────────
  // items は sessions から導出する。両方を props で渡すと同じ中身が2回直列化される。
  const items = useMemo(() => flattenItems(sessions), [sessions])
  const activeSessions = useMemo(() => sessions.filter(s => s.items.length > 0), [sessions])
  const eraLabels = useMemo(() => [...new Set(activeSessions.map(s => s.eraLabel))], [activeSessions])

  const resultTypes = useMemo(() => {
    const inData = new Set(items.map(i => i.result).filter(Boolean))
    const known = RESULT_ORDER.filter(r => inData.has(r))
    const hasOther = [...inData].some(r => !RESULT_ORDER.includes(r))
    return hasOther ? [...known, "その他"] : known
  }, [items])

  const filteredItems = useMemo<FlatItem[]>(() =>
    items.filter(item => {
      if (q && !item.title.includes(q) && !item.caseNumber.includes(q) && !item.sessionName.includes(q)) return false
      if (year && item.eraLabel !== year) return false
      if (session && item.sessionName !== session) return false
      if (type && item.caseType !== type) return false
      if (result === "その他") {
        if (RESULT_ORDER.includes(item.result)) return false
      } else if (result) {
        if (item.result !== result) return false
      }
      if (theme || issue) {
        const refs = links[linkKey(item)] ?? []
        if (theme && !refs.includes(`theme:${theme}`)) return false
        if (issue && !refs.includes(`issue:${issue}`)) return false
      }
      return true
    }), [items, q, year, session, type, result, theme, issue, links])

  const visibleItems = filteredItems.slice(0, limit)
  const hasMore   = visibleItems.length < filteredItems.length
  const hasFilter = !!(q || year || session || type || result || theme || issue)
  const isPending = inputValue !== q

  /** 解除ボタン付きのフィルタ表示。 */
  const Chip = ({ label, onClear, aria }: { label: string; onClear: () => void; aria: string }) => (
    <span className="inline-flex items-center gap-2 bg-ink border border-line text-textMain rounded-[3px] px-3 py-1.5 text-sm">
      {label}
      <button onClick={onClear} aria-label={aria} className="text-textMuted hover:text-textMain transition-colors leading-none">×</button>
    </span>
  )

  return (
    <>
      {/* ── 直近セッション（top 3） ───────────────────────── */}
      {activeSessions.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textMuted mb-3">最近の会議</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {activeSessions.slice(0, 3).map(s => (
              <div
                key={s.sessionName}
                onClick={() => setYear(year === s.eraLabel ? "" : s.eraLabel)}
                role="button"
                className={`cursor-pointer text-left bg-ink border rounded-[3px] p-4 transition-all ${
                  year === s.eraLabel ? "border-accent" : "border-line hover:border-accent"
                }`}
              >
                <div className="text-accent text-xs font-semibold mb-0.5">{s.eraLabel}</div>
                <div className="text-textMain font-semibold text-base">{s.sessionLabel}</div>
                {s.sessionRange && <div className="text-textMuted text-sm mt-1">{s.sessionRange}</div>}
                <div className="text-textMuted text-sm mt-2">{s.items.length} 件</div>
                {s.sessionId && (
                  <a
                    href={`/gikai/sessions/${s.sessionId}`}
                    onClick={e => e.stopPropagation()}
                    className="inline-block mt-3 text-xs text-accent transition-colors"
                  >
                    論点・争点を読む →
                  </a>
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
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ fontSize: "16px" }}
            className="w-full bg-ink border border-line rounded-[3px] px-4 py-3 pr-10 text-textMain placeholder-textMuted focus:outline-none focus:border-accent transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {inputValue ? (
              <button type="button" onClick={handleClear} aria-label="検索をクリア"
                      className="text-textMuted hover:text-textMain transition-colors p-1 leading-none">×</button>
            ) : isPending ? (
              <span className="text-textMuted text-sm select-none" aria-hidden="true">…</span>
            ) : null}
          </div>
        </div>

        {/* ── いま効いている条件 ──────────────────────────── */}
        {hasFilter && (
          <div className="flex flex-wrap gap-2 items-center">
            {q && <Chip label={`検索：${q}`} aria="検索条件を解除" onClear={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              setInputValue("")
              pushParams({ q: "", limit: "" })
            }} />}
            {year && <Chip label={year} aria="年度フィルタを解除" onClear={() => pushParams({ year: "", limit: "" })} />}
            {type && <Chip label={type} aria="種別フィルタを解除" onClear={() => pushParams({ type: "", limit: "" })} />}
            {result && <Chip label={result} aria="結果フィルタを解除" onClear={() => pushParams({ result: "", limit: "" })} />}
            {theme && <Chip
              label={`テーマ：${INSIGHT_THEME_LABELS[theme as keyof typeof INSIGHT_THEME_LABELS] ?? theme}`}
              aria="テーマフィルタを解除" onClear={() => pushParams({ theme: "", limit: "" })} />}
            {issue && <Chip label={`論点：${ISSUE_LABELS[issue] ?? issue}`} aria="論点フィルタを解除"
                            onClear={() => pushParams({ issue: "", limit: "" })} />}
            {session && <Chip label={session} aria="会議フィルタを解除" onClear={() => pushParams({ session: "", limit: "" })} />}
            <button onClick={resetFilters}
                    className="text-textMuted underline hover:text-textMain text-sm py-1.5 transition-colors">
              すべてリセット
            </button>
          </div>
        )}

        {/* ── 絞り込み ────────────────────────────────────
            記録（リスト）を先に見せ、条件は畳んでおく。
            検索窓とアクティブフィルタは畳まない（いま何で絞っているかは常に見える）。 */}
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none py-1
                              text-[12.5px] font-bold text-textMuted hover:text-textMain transition-colors">
            <span>絞り込み</span>
            {hasFilter && <span className="mono text-[11px] text-accent">条件あり</span>}
            <span className="mono text-[11px] text-textMuted group-open:hidden">開く ↓</span>
            <span className="mono text-[11px] text-textMuted hidden group-open:inline">閉じる ↑</span>
          </summary>

          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="bg-ink border border-line text-textMuted rounded-[3px] px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">年度：すべて</option>
                {eraLabels.map(era => <option key={era} value={era}>{era}</option>)}
              </select>

              {resultTypes.map(r => (
                <button
                  key={r}
                  onClick={() => setResult(r)}
                  className={`px-3 py-2 rounded-[3px] text-sm font-medium transition-colors border ${
                    result === r
                      ? "bg-accent text-onAccent border-accent"
                      : "bg-ink border-line text-textMuted hover:border-accent hover:text-textMain"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* ── 凡例 ─────────────────────────────────── */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-textMuted pt-1">
              {RESULT_ORDER.map(r => (
                <span key={r} className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${RESULT_DOT[r]}`} />
                  {r}
                </span>
              ))}
            </div>
          </div>
        </details>
      </section>

      {/* ── 件数 ──────────────────────────────────────────
          トップの索引と同じく、まず「何件あるか」を数で示してからリストに入る。 */}
      <div className="flex items-baseline justify-between border-t-[1.5px] border-textMain pt-4 pb-3 mb-1">
        <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textMuted">
          {hasFilter ? "絞り込んだ結果" : `${LABELS.giketsu.formal}の一覧`}
        </h2>
        <p className="text-textMuted text-[13px]">
          <span className="mono font-bold text-2xl md:text-[26px] text-textMain leading-none">
            {filteredItems.length.toLocaleString()}
          </span>
          <span className="ml-1.5">件</span>
        </p>
      </div>

      {/* ── リスト ───────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <div className="text-center text-textMuted py-20">該当する議案がありません</div>
      ) : (
        <>
          <div className="space-y-2">
            {visibleItems.map(item => (
              <GiketsuRow key={linkKey(item)} item={item} refs={links[linkKey(item)] ?? []} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                className="px-6 py-3 border border-line rounded-[3px] text-textMuted hover:border-accent hover:text-textMain transition-colors text-sm"
              >
                さらに表示（残り {(filteredItems.length - visibleItems.length).toLocaleString()} 件）
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
