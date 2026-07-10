// 継続論点の手動キュレーションデータ。/process トップのトレース図・論点索引と
// /process/issues の論点カードで共用する。論点の自動抽出はスコープ外（表示替えのみ）。

export interface SessionRef {
  sessionId: string
  date:      string
  title:     string
  conflict:  string
}

export interface Issue {
  id:          string
  title:       string
  status:      string
  /** 索引の一言（駅前交流センターの位置づけ 等）。無ければ summary の先頭を使う */
  lede?:       string
  summary:     string
  timelineTag: string
  sessions:    SessionRef[]
  detailHref?: string
}

/** 継続中・監視中・係争中は「まだ続いている」＝ accent（小豆ならカラマツ）で示す */
export function isHot(status: string): boolean {
  return /継続|監視|係争/.test(status)
}

export const ISSUES: Issue[] = [
  {
    id: "fiscal-balance",
    title: "財政規律 vs 投資・サービス維持",
    status: "継続中",
    lede: "借入増と償還平準化",
    summary: "借金が貯金を上回る財政状況の中で、必要な投資規模をどう確保するか。毎回の予算・決算審議で繰り返し浮上している。",
    timelineTag: "財政",
    sessions: [
      { sessionId: "r6-2024-09-kessan-tokubetsu", date: "2024-09-13", title: "令和5年度決算審査", conflict: "財政調整基金の残高と今後の財源確保" },
      { sessionId: "r7-2025-03-regular-1",        date: "2025-03-03", title: "令和7年度当初予算", conflict: "予算の規模・重点配分バランス" },
      { sessionId: "r7-2025-03-yosan-tokubetsu",  date: "2025-03-17", title: "予算審査特別委員会", conflict: "北斗クリニック医療転換・3本柱の投資規模" },
      { sessionId: "r7-2025-09-regular-3",        date: "2025-09-01", title: "令和7年定例第3回", conflict: "財政規律と未来投資の狭間" },
      { sessionId: "r7-2025-09-kessan-tokubetsu", date: "2025-09-12", title: "令和6年度決算審査", conflict: "貯金が借金を下回った財政構造の検証" },
    ],
  },
  {
    id: "medical-gap",
    title: "地域医療体制の空白",
    status: "継続中",
    lede: "巡回診療と閉院後の体制",
    summary: "北斗クリニック閉院（令和6年）以降、巡回診療での対応が続く。新得クリニック閉院後の体制が複数の会議で繰り返し問題になっている。",
    timelineTag: "医療",
    sessions: [
      { sessionId: "r6-2024-09-regular-3",       date: "2024-09-02", title: "令和6年定例第3回", conflict: "医療空白への対応が初めて議題に" },
      { sessionId: "r7-2025-03-yosan-tokubetsu",  date: "2025-03-17", title: "予算審査特別委員会", conflict: "巡回診療体制の確認" },
      { sessionId: "r7-2025-09-kessan-tokubetsu", date: "2025-09-12", title: "令和6年度決算審査", conflict: "閉院後の巡回診療継続を確認" },
      { sessionId: "r7-2025-12-regular-4",        date: "2025-12-02", title: "令和7年定例第4回", conflict: "地域医療体制の継続議論" },
    ],
  },
  {
    id: "tourism-tax",
    title: "宿泊税・観光財源の設計",
    status: "条例化済み・監視中",
    lede: "税率設定と使途",
    summary: "宿泊税は令和7年定例第2回で条例制定。税率設定（50〜500円）と観光財源としての使途が争点だった。徴収開始後の実績が次の焦点。",
    timelineTag: "観光",
    sessions: [
      { sessionId: "r6-2024-06-regular-2", date: "2024-06-04", title: "令和6年定例第2回", conflict: "宿泊税導入の是非と税率設計" },
      { sessionId: "r6-2024-09-regular-3", date: "2024-09-02", title: "令和6年定例第3回", conflict: "観光財源の使途と配分方針" },
      { sessionId: "r7-2025-06-regular-2", date: "2025-06-02", title: "令和7年定例第2回", conflict: "税率設定（50〜500円）と観光財源の使途" },
    ],
  },
  {
    id: "zero-carbon",
    title: "ゼロカーボン・エネルギー政策の遅れ",
    status: "検討中",
    lede: "水力・バイオマス活用",
    summary: "新得町のエネルギー資源（水力・バイオマス等）活用が政策として具体化されていない。ゼロカーボン調査が進行中だが結論未出。",
    timelineTag: "エネルギー",
    sessions: [
      { sessionId: "r6-2024-09-regular-3",    date: "2024-09-02", title: "令和6年定例第3回", conflict: "エネルギー資源活用の遅れ" },
      { sessionId: "r7-2025-06-regular-2",     date: "2025-06-02", title: "令和7年定例第2回", conflict: "ゼロカーボン調査の予算計上" },
      { sessionId: "r8-2026-01-20-basic-plan", date: "2026-01-20", title: "第9期総合計画審査特別委", conflict: "長期計画へのエネルギー政策の位置づけ" },
    ],
  },
  {
    id: "agriculture-sustainability",
    title: "農業の持続可能性",
    status: "検討中",
    lede: "担い手不足と気候変動対応",
    summary: "新得町の基幹産業である農業が、農家戸数の減少・担い手不足・気候変動対応という課題を抱える。議会での議論はまだ少ない。",
    timelineTag: "農業",
    sessions: [
      { sessionId: "r6-2024-09-regular-3", date: "2024-09-02", title: "令和6年定例第3回", conflict: "農業関連の補正予算" },
      { sessionId: "r7-2025-02-rinji-1",   date: "2025-02-03", title: "令和7年臨時第1回", conflict: "農業支援の物価高騰対策" },
      { sessionId: "r7-2025-12-regular-4", date: "2025-12-02", title: "令和7年定例第4回", conflict: "農業防疫・担い手問題の議論" },
    ],
  },
  {
    id: "tokutoku-role",
    title: "地域交流センター「とくとく」の役割",
    status: "検討中",
    lede: "観光拠点 vs 日常利用",
    summary: "観光拠点として整備された「とくとく」が、町民の日常利用の場としても機能すべきかをめぐる議論。令和7年12月定例会で浮上。",
    timelineTag: "観光",
    sessions: [
      { sessionId: "r7-2025-12-regular-4", date: "2025-12-02", title: "令和7年定例第4回", conflict: "観光拠点 vs 日常利用の議論が一般質問で浮上" },
    ],
    detailHref: "/process/issues/tuktuk",
  },
]

// ── スパンバー計算（論点索引の横棒）──────────────────────────────────────────
// 横軸は最初の会期（2024.06）から現在まで。継続中の論点は現在まで伸ばす。

const AXIS_START = Date.parse("2024-06-01")

export interface Span {
  /** 軸左端からの開始位置（%）*/
  leftPct:  number
  /** バーの幅（%）*/
  widthPct: number
}

/** 継続中は右端（現在）まで、一区切りは最終会期まで。axisEnd は呼び出し側が渡す（now を注入）。*/
export function computeSpan(issue: Issue, axisEnd: number): Span {
  const dates = issue.sessions.map(s => Date.parse(s.date))
  const first = Math.min(...dates)
  const last  = isHot(issue.status) ? axisEnd : Math.max(...dates)
  const total = axisEnd - AXIS_START
  const leftPct  = ((first - AXIS_START) / total) * 100
  const rightPct = ((last  - AXIS_START) / total) * 100
  return { leftPct, widthPct: Math.max(rightPct - leftPct, 4) }
}
