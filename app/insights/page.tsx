import fs from "fs"
import path from "path"
import Link from "next/link"

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

const THEME_IDS = ["agriculture", "tourism", "health", "community", "finance"] as const
type ThemeId = (typeof THEME_IDS)[number]

const THEME_LABELS: Record<ThemeId, string> = {
  agriculture: "農業・産業",
  tourism:     "観光",
  health:      "健康・福祉",
  community:   "地域・参加",
  finance:     "財政",
}


// ─────────────────────────── Helpers ──────────────────────────────

function loadJSON<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
  } catch {
    return fallback
  }
}

/** ヒートマップのセル背景 + 文字色（4段階） */
function heatClass(count: number): string {
  if (count === 0) return ""
  if (count <= 2)  return "bg-accent/20 text-textMain"
  if (count <= 5)  return "bg-accent/45 text-textMain"
  return                  "bg-accent/70 text-base font-semibold"
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
    .map((id) => ({ id, label: THEME_LABELS[id], count: themeCounts[id] ?? 0 }))
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
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">

      {/* ヘッダー */}
      <div className="mb-12">
        <Link
          href="/"
          className="text-textSub text-sm hover:text-textMain transition-colors mb-4 inline-block"
        >
          ← トップ
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          インサイト
        </h1>
        <p className="text-textMain/70 text-lg">
          議会議決 × 政策テーマ・論点のクロス集計
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-textSub">
          <span>議決結果とテーマ・論点の関係を俯瞰できます。</span>
          <div className="flex items-center gap-3">
            <Link href="/gikai" className="text-accent hover:underline transition-colors">
              → 議会（一覧）
            </Link>
            <Link href="/process" className="text-accent hover:underline transition-colors">
              → 意思決定プロセス
            </Link>
          </div>
        </div>
      </div>

      {/* ── A. ヒートマップ ────────────────────────────────── */}
      <section className="mb-14">
        <h2 className="text-xs font-semibold text-textSub tracking-widest mb-1">
          年度 × テーマ ヒートマップ
        </h2>
        <p className="text-xs text-textSub mb-4">
          セルをクリックすると /gikai に絞り込み遷移します
        </p>

        <div className="bg-ink border border-line rounded-xl overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-ink text-left px-4 py-3 text-textSub text-xs font-medium border-b border-line w-28">
                  テーマ
                </th>
                {sortedEras.map((era) => (
                  <th
                    key={era}
                    className="px-2 py-3 text-textSub text-xs font-medium border-b border-line text-center whitespace-nowrap min-w-[3rem]"
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
                    {THEME_LABELS[themeId]}
                  </td>
                  {sortedEras.map((era) => {
                    const count = heatmap[era]?.[themeId] ?? 0
                    const tipLabel = `${THEME_LABELS[themeId]} / ${eraYearMap.get(era)}: ${count}件`
                    return (
                      <td key={era} className="p-0.5 text-center">
                        {count > 0 ? (
                          <Link
                            href={`/gikai?theme=${themeId}&year=${encodeURIComponent(era)}`}
                            title={tipLabel}
                            className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded text-xs transition-opacity hover:opacity-75 ${heatClass(count)}`}
                          >
                            {count}
                          </Link>
                        ) : (
                          <span
                            title={tipLabel}
                            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-xs text-textSub/20"
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
      <section className="mb-14">
        <div className="bg-ink border border-line rounded-xl p-6">
          <h2 className="text-xs font-semibold text-textSub tracking-widest mb-4">
            テーマ別 議決件数
          </h2>
          <div className="space-y-2">
            {themeRanking.map(({ id, label, count }) => (
              <Link
                key={id}
                href={`/gikai?theme=${id}`}
                className="flex items-center gap-4 border border-line/60 rounded-lg px-4 py-3 hover:border-accent hover:bg-accent/5 transition-all group"
              >
                <span className="text-textMain text-sm font-medium w-24 shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${(count / maxThemeCount) * 100}%` }}
                  />
                </div>
                <span className="text-textSub text-xs w-10 text-right shrink-0 tabular-nums">
                  {count}件
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── D. 会議アーカイブ × テーマ ─────────────────────── */}
      <section className="mb-14">
        <div className="bg-ink border border-line rounded-xl p-6">
          <h2 className="text-xs font-semibold text-textSub tracking-widest mb-1">
            会議アーカイブ × テーマ
          </h2>
          <p className="text-xs text-textSub mb-4">
            論点・争点アーカイブのテーマ分布
          </p>
          <div className="space-y-2">
            {tagRanking.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/gikai/sessions?tag=${encodeURIComponent(tag)}`}
                className="flex items-center gap-4 border border-line/60 rounded-lg px-4 py-3 hover:border-accent hover:bg-accent/5 transition-all group"
              >
                <span className="text-textMain text-sm font-medium w-28 shrink-0">
                  {tag}
                </span>
                <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${(count / maxTagCount) * 100}%` }}
                  />
                </div>
                <span className="text-textSub text-xs w-10 text-right shrink-0 tabular-nums">
                  {count}件
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
