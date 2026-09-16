import fs from "fs"
import path from "path"
import type { Metadata } from "next"
import Link from "next/link"
import { LABELS, INSIGHT_THEME_LABELS, type InsightThemeId } from "@/lib/labels"

export const metadata: Metadata = {
  title: `${LABELS.insights.text} | Shintoku Atlas`,
  description: "議決の分布・タグ・年別推移を読む。",
}

// ─────────────────────────── Types ────────────────────────────────

interface GiketsuItem {
  caseType: string
  num: number
}

interface GiketsuSession {
  year: number
  eraLabel: string
  items: GiketsuItem[]
}

interface GikaiSessionTagged {
  id:   string
  tags: string[]
}

type GikaiLinks = Record<string, string[]>

// ─────────────────────────── Label maps ───────────────────────────

// テーマ名は lib/labels.ts（翻訳層）が持つ。ここでは並び順だけ決める。
const THEME_IDS = ["agriculture", "tourism", "health", "community", "finance"] as const satisfies readonly InsightThemeId[]


// ─────────────────────────── Helpers ──────────────────────────────

function loadJSON<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
  } catch {
    return fallback
  }
}

/**
 * ヒートマップのセル背景 + 文字色（3段階）とホバー。
 *
 * ホバーは opacity で薄めない。要素ごと薄くすると地だけでなく文字も一緒に薄まり、
 * 最上位のセルが 4.92:1 → 2.56:1 まで落ちる（透過で階調を作らない＝
 * docs/design/text-scale.md の規律）。濃い方へ一段送って、色で反応を示す。
 */
function heatClass(count: number): string {
  if (count === 0) return ""
  if (count <= 2)  return "bg-accent/20 text-textMain hover:bg-accent/45"
  if (count <= 5)  return "bg-accent/45 text-textMain hover:bg-accent hover:text-onAccent"
  return                  "bg-accent text-onAccent font-semibold hover:bg-accentSoft"
}

// ─────────────────────────── Page ─────────────────────────────────

export default function InsightsPage() {
  const root = process.cwd()

  const sessions = loadJSON<GiketsuSession[]>(
    path.join(root, "public", "data", "giketsu_index.json"),
    []
  )
  const links = loadJSON<GikaiLinks>(
    path.join(root, "public", "data", "gikai_links.json"),
    {}
  )
  const gikaiSessions = loadJSON<GikaiSessionTagged[]>(
    path.join(root, "public", "data", "gikai_sessions.json"),
    []
  )

  // ── eraLabel 一覧（year 降順） ───────────────────────────────
  const eraYearMap = new Map<string, number>()
  for (const s of sessions) {
    if (!eraYearMap.has(s.eraLabel)) eraYearMap.set(s.eraLabel, s.year)
  }
  const sortedEras = [...eraYearMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([era]) => era)

  // ── 集計 ────────────────────────────────────────────────────
  // heatmap[eraLabel][themeId] = count
  const heatmap: Record<string, Record<string, number>> = {}
  const themeCounts: Record<string, number> = Object.fromEntries(
    THEME_IDS.map((id) => [id, 0])
  )

  for (const session of sessions) {
    for (const item of session.items) {
      const key = `${session.eraLabel}-${item.caseType}-${item.num}`
      const refs = links[key] ?? []
      for (const ref of refs) {
        const sep = ref.indexOf(":")
        const kind = ref.slice(0, sep)
        const id   = ref.slice(sep + 1)
        if (kind === "theme") {
          heatmap[session.eraLabel] ??= {}
          heatmap[session.eraLabel][id] = (heatmap[session.eraLabel][id] ?? 0) + 1
          themeCounts[id] = (themeCounts[id] ?? 0) + 1
        }
      }
    }
  }

  // テーマランキング（count 降順）
  const themeRanking = THEME_IDS
    .map((id) => ({ id, label: INSIGHT_THEME_LABELS[id], count: themeCounts[id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
  const maxThemeCount = Math.max(1, ...themeRanking.map((t) => t.count))

  // タグランキング（gikai_sessions.json の tags フィールドから集計、count 降順）
  const tagCountMap: Record<string, number> = {}
  for (const s of gikaiSessions) {
    for (const tag of s.tags ?? []) {
      tagCountMap[tag] = (tagCountMap[tag] ?? 0) + 1
    }
  }
  const tagRanking = Object.entries(tagCountMap)
    .sort(([, a], [, b]) => b - a)
    .map(([tag, count]) => ({ tag, count }))
  const maxTagCount = Math.max(1, ...tagRanking.map((t) => t.count))

  // ── JSX ─────────────────────────────────────────────────────
  return (
    <div className="max-w-[1040px] mx-auto px-6">

      {/* ── ヘッダー ───────────────────────────────────────── */}
      <div className="pt-12 pb-2 mb-8">
        <p className="text-[12px] font-bold tracking-[0.14em] text-accent mb-3">
          調べ物の入口
        </p>
        <h1
          className="font-mincho font-bold leading-[1.4] text-textMain"
          style={{ fontSize: "clamp(26px, 4vw, 38px)" }}
        >
          {LABELS.insights.text}
        </h1>
        <p className="text-[13.5px] text-textMuted mt-2.5 max-w-[560px]">
          {LABELS.giketsu.text}がどのテーマに、どの年度に集まっているか。
          数を手がかりに、読む会期を選ぶためのページです。
        </p>
        <Link
          href="/gikai/sessions"
          className="group inline-block text-[13px] font-bold border-b-2 border-textMain pb-[2px] mt-4
                     transition-colors hover:text-accent hover:border-accent"
        >
          {LABELS.sessions.formal}の記録を読む →
        </Link>
      </div>

      {/* ── A. ヒートマップ ──────────────────────────────────
          表・棒グラフは他ページに無い形式なので、bg-ink の器は据え置く。
          揃えるのは見出しの語彙とページヘッダーだけ。 */}
      <section className="mb-12 border-t-[1.5px] border-textMain">
        <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textMuted pt-4">
          年度 × テーマ
        </h2>
        <p className="text-[12.5px] text-textMuted mt-1 mb-4">
          セルを押すと、その年度・テーマの{LABELS.giketsu.text}だけを一覧にします。
        </p>

        <div className="bg-ink border border-line rounded-[3px] overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-ink text-left px-4 py-3 text-textMuted text-xs font-medium border-b border-line w-28">
                  テーマ
                </th>
                {sortedEras.map((era) => (
                  <th
                    key={era}
                    className="px-2 py-3 text-textMuted text-xs font-medium border-b border-line text-center whitespace-nowrap min-w-[3rem]"
                  >
                    {eraYearMap.get(era)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {THEME_IDS.map((themeId, ri) => (
                <tr
                  key={themeId}
                  className={ri < THEME_IDS.length - 1 ? "border-b border-line/40" : ""}
                >
                  <td className="sticky left-0 bg-ink px-4 py-2 text-textMain text-xs font-medium whitespace-nowrap">
                    {INSIGHT_THEME_LABELS[themeId]}
                  </td>
                  {sortedEras.map((era) => {
                    const count = heatmap[era]?.[themeId] ?? 0
                    const tipLabel = `${INSIGHT_THEME_LABELS[themeId]} / ${eraYearMap.get(era)}: ${count}件`
                    return (
                      <td key={era} className="p-0.5 text-center">
                        {count > 0 ? (
                          <Link
                            href={`/gikai?theme=${themeId}&year=${encodeURIComponent(era)}`}
                            title={tipLabel}
                            className={`mono inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-[3px] text-xs transition-colors ${heatClass(count)}`}
                          >
                            {count}
                          </Link>
                        ) : (
                          <span
                            title={tipLabel}
                            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-xs text-textMuted"
                          >
                            —
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── B. テーマ別ランキング ───────────────────────────── */}
      <section className="mb-12 border-t-[1.5px] border-textMain">
        <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textMuted pt-4 mb-4">
          テーマ別の{LABELS.giketsu.text}
        </h2>
        <div className="bg-ink border border-line rounded-[3px] p-6">
          <div className="space-y-2">
            {themeRanking.map(({ id, label, count }) => (
              <Link
                key={id}
                href={`/gikai?theme=${id}`}
                className="flex items-center gap-4 border border-line/60 rounded-[3px] px-4 py-3 hover:border-accent hover:bg-accent/5 transition-all group"
              >
                <span className="text-textMain text-sm font-medium w-24 shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-1.5 bg-line rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-[2px]" /* contrast-ok: 棒グラフの帯。文字は載らない */
                    style={{ width: `${(count / maxThemeCount) * 100}%` }}
                  />
                </div>
                <span className="mono text-textMuted text-xs w-10 text-right shrink-0">
                  {count}件
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── C. 会期のテーマ分布 ─────────────────────────────── */}
      <section className="mb-12 border-t-[1.5px] border-textMain">
        <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textMuted pt-4">
          会期に付いたテーマ
        </h2>
        <p className="text-[12.5px] text-textMuted mt-1 mb-4">
          押すと、そのテーマを含む会期の記録を一覧にします。
        </p>
        <div className="bg-ink border border-line rounded-[3px] p-6">
          <div className="space-y-2">
            {tagRanking.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/gikai/sessions?tag=${encodeURIComponent(tag)}`}
                className="flex items-center gap-4 border border-line/60 rounded-[3px] px-4 py-3 hover:border-accent hover:bg-accent/5 transition-all group"
              >
                <span className="text-textMain text-sm font-medium w-28 shrink-0">
                  {tag}
                </span>
                <div className="flex-1 h-1.5 bg-line rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-[2px]" /* contrast-ok: 棒グラフの帯。文字は載らない */
                    style={{ width: `${(count / maxTagCount) * 100}%` }}
                  />
                </div>
                <span className="mono text-textMuted text-xs w-10 text-right shrink-0">
                  {count}件
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="h-16" />
    </div>
  )
}
