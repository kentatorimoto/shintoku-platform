import view from "@/content/traces/ekimae.view.json"

const LANES = ["駅前広場", "とくとく本体", "温浴宿泊施設", "町営浴場", "金融機関", "指定管理"]
const SHORT: Record<string, string> = {
  駅前広場: "駅前広場", とくとく本体: "とくとく", 温浴宿泊施設: "温浴宿泊", 町営浴場: "町営浴場", 金融機関: "金融機関", 指定管理: "指定管理",
}
const [hamada, yuasa] = view.mayors
const toDot = (iso: string) => iso.replace(/-/g, ".")

type Point = (typeof view.points)[number]
const tip = (p: Point) => `${toDot(p.date)} ${p.label}（${p.citation.speaker} ${p.citation.role}／${p.citation.meeting} p.${p.citation.page}）`
const reasonNumber = (p: Point) => view.points.filter(x => x.reason).findIndex(x => x.id === p.id) + 1

// ── 横向き（広い画面）────────────────────────────────────────────────────
const W = 1000
const LEFT = 92
const RIGHT = 12
const TOP = 34
const LANE_H = 58
const X_START = 2010
const X_END = 2027
const BOTTOM = TOP + LANE_H * LANES.length
const MIN_GAP = 13
const TIERS = [0, -14, 14]
const REASON_GAP = 24
const QUIET_BAR_H = 130
const QUIET_MAX = Math.max(...view.quietYears.map(q => q.count))
const QUIET_TOTAL = view.quietYears.reduce((n, q) => n + q.count, 0)
const QUIET_NOTE = `2010〜2016年 年表に載る出来事なし・駅前に関する発言 ${QUIET_TOTAL}件（棒は年ごとの件数。軸を縮めています）`

const yearOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return y + (m - 1 + (d - 1) / 30) / 12
}
// 2017年より前は年表の点が無いので、その区間を縮める（軸に波線を入れて明示する）
const X_BREAK = 2017
const BREAK_SHARE = 0.14
const xOf = (year: number) => {
  const span = W - LEFT - RIGHT
  return year < X_BREAK
    ? LEFT + ((year - X_START) / (X_BREAK - X_START)) * span * BREAK_SHARE
    : LEFT + span * BREAK_SHARE + ((year - X_BREAK) / (X_END - X_BREAK)) * span * (1 - BREAK_SHARE)
}
const laneY = (lane: string) => TOP + LANE_H * LANES.indexOf(lane) + LANE_H / 2

/** 点は必ず日付の位置に置く。同じ帯で重なるときは、帯の中で上下の段に分ける */
function laneTiers() {
  const tiers = new Map<string, number>()
  const lastOnTier = new Map<string, number>()
  for (const p of view.points.filter(x => !x.whole)) {
    const x = xOf(yearOf(p.date))
    for (const lane of p.objects) {
      const tier = TIERS.find(t => x - (lastOnTier.get(`${lane}#${t}`) ?? -Infinity) >= MIN_GAP) ?? 0
      lastOnTier.set(`${lane}#${tier}`, x)
      tiers.set(`${p.id}-${lane}`, tier)
    }
  }
  return tiers
}

function Marker({ p, x, y }: { p: Point; x: number; y: number }) {
  const color = p.change ? "var(--color-accent)" : "var(--color-textMain)"
  // 広報由来は四角、会議録由来は丸
  if (p.sourceType === "koho") {
    return p.planned
      ? <rect x={x - 5} y={y - 5} width={10} height={10} fill="var(--color-paper)" stroke={color} strokeWidth={2} />
      : <rect x={x - 5.5} y={y - 5.5} width={11} height={11} fill={color} stroke="var(--color-paper)" strokeWidth={1.5} />
  }
  return p.planned
    ? <circle cx={x} cy={y} r={5.5} fill="var(--color-paper)" stroke={color} strokeWidth={2} />
    : <circle cx={x} cy={y} r={6} fill={color} stroke="var(--color-paper)" strokeWidth={2} />
}

export default function DesktopTimeline() {
  const tiers = laneTiers()
  const boundary = xOf(yearOf("2025-07-15"))
  const years = Array.from({ length: X_END - X_START + 1 }, (_, i) => X_START + i)
  const reasons = view.points.filter(p => p.reason)
  const H = BOTTOM + 58

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
           aria-label="駅前の再整備の出来事を6つの対象の帯に並べた年表。背景は町長の任期">
        <rect x={boundary} y={TOP - 26} width={W - RIGHT - boundary} height={BOTTOM - TOP + 26} fill="var(--color-ink)" />
        <a href={hamada.citation.url} target="_blank" rel="noopener noreferrer">
          <text x={LEFT + 4} y={TOP - 11} fontSize={12} fill="var(--color-textMuted)">{hamada.name}</text>
        </a>
        <a href={yuasa.citation.url} target="_blank" rel="noopener noreferrer">
          <text x={W - RIGHT - 4} y={TOP - 11} fontSize={12} textAnchor="end" fill="var(--color-textMuted)">{yuasa.name}</text>
        </a>

        {years.map(y => (
          <g key={y}>
            {y >= X_BREAK && <line x1={xOf(y)} x2={xOf(y)} y1={TOP} y2={BOTTOM} stroke="var(--color-line)" />}
            {y < X_END && y >= X_BREAK && (
              <text x={xOf(y)} y={BOTTOM + 16} fontSize={11} fill="var(--color-textMuted)" className="mono">{y}</text>
            )}
          </g>
        ))}
        {LANES.map(l => (
          <g key={l}>
            <line x1={LEFT} x2={W - RIGHT} y1={laneY(l)} y2={laneY(l)} stroke="var(--color-lineStrong)" />
            <text x={0} y={laneY(l) + 4} fontSize={12.5} fontWeight={700} fill="var(--color-textMain)">{l}</text>
          </g>
        ))}
        <rect x={xOf(X_START) + 1} y={TOP} width={xOf(X_BREAK) - xOf(X_START) - 2} height={BOTTOM - TOP} fill="var(--color-paper)" />
        {view.quietYears.map((q) => {
          const x0 = xOf(q.year) + 1
          const w = xOf(q.year + 1) - xOf(q.year) - 2
          const h = (q.count / QUIET_MAX) * QUIET_BAR_H
          return (
            <g key={q.year}>
              <title>{`${q.year}年 年表に載る出来事なし・駅前に関する発言 ${q.count}件`}</title>
              <rect x={x0} y={BOTTOM - h} width={w} height={h} fill="var(--color-line)" />
              <text x={x0 + w / 2} y={BOTTOM - h - 4} fontSize={10.5} textAnchor="middle" fill="var(--color-textMuted)" className="mono">{q.count}</text>
              <text x={x0 + w / 2} y={BOTTOM + 16} fontSize={10.5} textAnchor="middle" fill="var(--color-textMuted)" className="mono">{String(q.year).slice(2)}</text>
            </g>
          )
        })}
        <foreignObject x={xOf(X_START) + 2} y={TOP + 4} width={xOf(X_BREAK) - xOf(X_START) - 4} height={90}>
          <p className="text-[11px] leading-snug text-textMuted">{QUIET_NOTE}</p>
        </foreignObject>

        {/* 全体の話は帯を横断する線 */}
        {view.points.filter(p => p.whole).map((p) => {
          const x = xOf(yearOf(p.date))
          const color = p.change ? "var(--color-accent)" : "var(--color-textMain)"
          return (
            <a key={p.id} href={p.citation.url} target="_blank" rel="noopener noreferrer" aria-label={tip(p)}>
              <title>{tip(p)}</title>
              <rect x={x - 7} y={TOP} width={14} height={BOTTOM - TOP} fill="transparent" />
              <line x1={x} x2={x} y1={TOP + 4} y2={BOTTOM - 4} stroke={color} strokeWidth={2}
                    strokeDasharray={p.planned ? "3 4" : undefined} strokeLinecap="round" />
              {p.direct && <text x={x} y={TOP + 12} dx={5} fontSize={11.5} fontWeight={700} fill="var(--color-textMain)">{p.direct}</text>}
            </a>
          )
        })}

        {/* 理由の線 */}
        {reasons.map((p, i) => {
          const x = xOf(yearOf(p.date))
          const y = p.whole ? BOTTOM : Math.max(...p.objects.map(laneY))
          const n = reasonNumber(p)
          // 番号は重ならないよう、右端から詰めて並べる
          const labelX = Math.min(x, W - RIGHT - 10 - (reasons.length - 1 - i) * REASON_GAP)
          return (
            <g key={p.id}>
              <path d={`M ${x} ${y} L ${x} ${BOTTOM + 22} L ${labelX} ${BOTTOM + 36}`} fill="none" stroke="var(--color-accent)" strokeWidth={1} />
              <circle cx={labelX} cy={BOTTOM + 44} r={9} fill="var(--color-accent)" />
              <text x={labelX} y={BOTTOM + 48} fontSize={11} fontWeight={700} textAnchor="middle" fill="var(--color-onAccent)">{n}</text>
            </g>
          )
        })}

        {/* 帯の上の点 */}
        {view.points.filter(p => !p.whole).flatMap(p => p.objects.map((o) => {
          const x = xOf(yearOf(p.date))
          const y = laneY(o) + (tiers.get(`${p.id}-${o}`) ?? 0)
          return (
            <a key={`${p.id}-${o}`} href={p.citation.url} target="_blank" rel="noopener noreferrer" aria-label={tip(p)}>
              <title>{tip(p)}</title>
              <circle cx={x} cy={y} r={13} fill="transparent" />
              <Marker p={p} x={x} y={y} />
              {p.direct && o === p.objects[p.objects.length - 1] && (
                <text x={x} y={laneY(o) - 18} fontSize={11.5} fontWeight={700} textAnchor="middle" fill="var(--color-textMain)">{p.direct}</text>
              )}
            </a>
          )
        }))}
      </svg>

      <Legend />
      <ol className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {reasons.map(p => <ReasonCard key={p.id} p={p} n={reasonNumber(p)} />)}
      </ol>
    </div>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[12px] text-textMuted">
      <li><span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full bg-textMain mr-1.5" />実施・報告</li>
      <li><span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full border-2 border-textMain mr-1.5" />予定</li>
      <li><span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full bg-accent mr-1.5 text-onAccent" />増額・延期・白紙</li>
      <li><span aria-hidden className="inline-block w-2.5 h-2.5 bg-textMain mr-1.5" />四角は広報しんとく（丸は会議録）</li>
      <li className="hidden md:list-item">縦の線は事業全体の話（破線は予定）</li>
      <li className="md:hidden">横の線は事業全体の話</li>
    </ul>
  )
}

function ReasonCard({ p, n }: { p: Point; n: number }) {
  const r = p.reason
  if (!r) return null
  return (
    <li className="list-none border-l-2 border-accent pl-3">
      {n > 0 && (
        <p className="text-[12px] text-textMuted mb-1">
          <span className="font-bold text-accent mr-1">{n}</span>
          {toDot(p.date)} {p.label}
        </p>
      )}
      <p className="text-[12px] font-bold text-textMuted">
        町が示した理由{r.certainty === "推測" && <span className="text-accent">（推測）</span>}
      </p>
      <p className="text-sm font-bold leading-snug text-textMain">「{r.text}」</p>
      <a href={r.citation.url} target="_blank" rel="noopener noreferrer"
         className="text-[12px] text-textMuted underline underline-offset-2 hover:text-accent transition-colors">
        {r.citation.speaker} {r.citation.role} ／ {r.citation.meeting} p.{r.citation.page}
      </a>
    </li>
  )
}

// ── 縦向き（スマホ）──────────────────────────────────────────────────────
const ROW = "grid grid-cols-[46px_repeat(6,17px)_minmax(0,1fr)] items-center gap-x-[2px]"

function MobileDot({ p }: { p: Point }) {
  const color = p.change ? "bg-accent text-onAccent" : "bg-textMain"
  const ring = p.change ? "border-accent" : "border-textMain"
  const shape = p.sourceType === "koho" ? "" : "rounded-full"
  return p.planned
    ? <span className={`block w-[11px] h-[11px] ${shape} border-2 ${ring} bg-paper`} />
    : <span className={`block w-[11px] h-[11px] ${shape} ${color}`} />
}

/** 同じ施設の予定が、いつ、どの時期として示されたか。行為が延期の行を太くする */
export function PlanChanges() {
  return (
    <div className="mt-8">
      <h3 className="text-[15px] font-bold text-textMain mb-3">予定の変わり方</h3>
      <div className="grid md:grid-cols-3 gap-5">
        {view.planChanges.map(group => (
          <div key={group.name}>
            <p className="text-[13px] font-bold text-textMuted mb-2">{group.name}</p>
            <ol className="space-y-1">
              {group.rows.map((r, i) => {
                return (
                  <li key={`${r.date}-${i}`} className="flex gap-2 text-[13px] leading-snug">
                    <a href={r.citation.url} target="_blank" rel="noopener noreferrer"
                       aria-label={`${toDot(r.date)} ${r.target}（${r.citation.meeting} p.${r.citation.page}）`}
                       className="mono text-[11px] text-textMuted underline underline-offset-2 hover:text-accent shrink-0 pt-px">
                      {r.date.slice(0, 7).replace("-", ".")}
                    </a>
                    <span className={r.moved ? "font-bold text-textMain" : "text-textSub"}>
                      {r.target}
                      <span className="text-[10px] font-normal text-textMuted ml-1">{r.sourceType === "koho" ? "広報" : "会議録"}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MobileTimeline() {
  const isYuasa = (p: Point) => p.date >= "2025-08"

  return (
    <div>
      <div className={`${ROW} sticky top-[52px] z-10 bg-paper border-b border-lineStrong pb-1 pt-1`}>
        <span />
        {LANES.map(l => (
          <span key={l} className="text-[10px] font-bold leading-none text-textMain [writing-mode:vertical-rl] h-[56px] justify-self-center">
            {SHORT[l]}
          </span>
        ))}
        <span />
      </div>

      <a href={hamada.citation.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] font-bold text-textMuted py-2 underline underline-offset-2">
        {hamada.name}
      </a>
      <figure className="mb-3">
        <div className="flex items-end gap-1 h-[72px]">
          {view.quietYears.map(q => (
            <div key={q.year} className="flex-1 flex flex-col justify-end items-center h-full">
              <span className="mono text-[10px] text-textMuted">{q.count}</span>
              <span className="w-full bg-line" style={{ height: `${(q.count / QUIET_MAX) * 48}px` }} />
              <span className="mono text-[10px] text-textMuted">{q.year}</span>
            </div>
          ))}
        </div>
        <figcaption className="text-[12px] leading-relaxed text-textMuted mt-1">{QUIET_NOTE.replace("（棒は年ごとの件数。軸を縮めています）", "（棒は年ごとの件数）")}</figcaption>
      </figure>

      {view.points.map((p, i) => {
        const year = p.date.slice(0, 4)
        const showYear = i === 0 || view.points[i - 1].date.slice(0, 4) !== year
        const startsYuasa = isYuasa(p) && (i === 0 || !isYuasa(view.points[i - 1]))
        return (
          <div key={p.id} className={isYuasa(p) ? "bg-ink -mx-4 px-4" : ""}>
            {startsYuasa && (
              <a href={yuasa.citation.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] font-bold text-textMuted pt-3 pb-1 underline underline-offset-2">
                {yuasa.name}
              </a>
            )}
            <a href={p.citation.url} target="_blank" rel="noopener noreferrer" aria-label={tip(p)}
               className={`${ROW} min-h-[44px] py-1 border-b border-line active:bg-line`}>
              <span className="leading-tight">
                {showYear && <span className="mono block text-[13px] font-bold text-textMain">{year}</span>}
                <span className="mono block text-[10px] text-textMuted">{p.date.slice(5).replace("-", "/")}</span>
              </span>
              {p.whole
                ? <span className="col-span-6 flex items-center" aria-hidden>
                    <span className={`block w-full h-[3px] rounded-full ${p.change ? "bg-accent text-onAccent" : "bg-textMain"} ${p.planned ? "[background:repeating-linear-gradient(90deg,var(--color-textMain)_0_4px,transparent_4px_8px)]" : ""}`} />
                  </span>
                : LANES.map(l => (
                    <span key={l} className="flex justify-center items-center h-full relative" aria-hidden>
                      <span className="absolute inset-y-[-4px] left-1/2 w-px bg-line" />
                      {p.objects.includes(l) && <span className="relative"><MobileDot p={p} /></span>}
                    </span>
                  ))}
              <span className={`pl-2 text-[13px] leading-snug ${p.change ? "font-bold text-textMain" : "text-textSub"}`}>
                {p.label}
                {p.sourceType === "koho" && <span className="block text-[10px] text-textMuted">広報しんとく</span>}
              </span>
            </a>
            {p.reason && (
              <ul className="ml-[46px] py-2.5"><ReasonCard p={p} n={0} /></ul>
            )}
          </div>
        )
      })}
      <Legend />
    </div>
  )
}
