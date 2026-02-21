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

const ISSUE_LABELS: Record<string, string> = {
  "agri-conservative-target": "農業は年1%成長で町を支え続けられるか？",
  "agri-fewer-farms":         "農家戸数が減っても農業総額を維持できるか？",
  "agri-climate":             "気候変動で作物転換は必要になるか？",
  "agri-smart":               "技術で農業の労働力不足は補えるか？",
  "tourism-satisfaction":     "なぜ町民は観光の成果に満足していないのか？",
  "tourism-org-reform":       "新得町に新しい観光組織は必要か？",
  "tourism-residents":        "なぜ町民は観光の魅力を実感できていないのか？",
  "finance-post-project":     "大型事業後の借金をどうコントロールするか？",
  "finance-kpi":              "財政の\u201c安全運転ライン\u201dは何か？",
  "finance-slack":            "財政の\u201c余力\u201dをどう確保するか？",
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
  const issueCounts: Record<string, number> = {}

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
        } else if (kind === "issue") {
          issueCounts[id] = (issueCounts[id] ?? 0) + 1
        }
      }
    }
  }

  // テーマランキング（count 降順）
  const themeRanking = THEME_IDS
    .map((id) => ({ id, label: THEME_LABELS[id], count: themeCounts[id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
  const maxThemeCount = Math.max(1, ...themeRanking.map((t) => t.count))

  // 論点ランキング top 10
  const issueRanking = Object.entries(issueCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id, count]) => ({ id, label: ISSUE_LABELS[id] ?? id, count }))

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

      {/* ── C. 論点別ランキング top 10 ─────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-textSub tracking-widest mb-4">
          論点別 議決件数（上位10）
        </h2>

        {issueRanking.length === 0 ? (
          <div className="bg-ink border border-line rounded-xl px-6 py-8 space-y-3">
            <p className="text-textSub text-sm">
              論点リンクデータがまだありません。
            </p>
            <p className="text-textSub text-xs leading-relaxed">
              <span className="text-textMain font-medium">data/gikai_links.csv</span>{" "}
              に以下のような行を追加し、<code className="bg-line rounded px-1 py-0.5">npm run build:links</code> を実行してください。
            </p>
            <pre className="text-xs bg-line/60 rounded-lg px-4 py-3 text-textSub overflow-x-auto leading-relaxed">
{`caseType,num,ref
議案,2,issue:finance-kpi
議案,5,issue:agri-climate`}
            </pre>
          </div>
        ) : (
          <div className="bg-ink border border-line rounded-xl overflow-hidden hover:border-accent transition-all">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-4 py-3 text-textSub text-xs font-medium w-8">#</th>
                  <th className="text-left px-4 py-3 text-textSub text-xs font-medium">論点</th>
                  <th className="text-right px-4 py-3 text-textSub text-xs font-medium w-16">件数</th>
                </tr>
              </thead>
              <tbody>
                {issueRanking.map(({ id, label, count }, i) => (
                  <tr
                    key={id}
                    className={i < issueRanking.length - 1 ? "border-b border-line/40" : ""}
                  >
                    <td className="px-4 py-3 text-textSub text-xs tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/gikai?issue=${id}`}
                        className="text-textMain hover:text-accent transition-colors line-clamp-2 text-sm"
                      >
                        {label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-textSub text-xs tabular-nums">
                      {count}件
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
