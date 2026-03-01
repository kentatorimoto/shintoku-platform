// 新得駅前地域交流センター「とくとく」構造化データ
// 出典はすべて SHINTOKU ATLAS 内のデータから抽出

export interface TuktukEvent {
  date: string
  type: "質問" | "議案" | "報告" | "予算" | "契約" | "設計" | "運営" | "開所"
  summary: string
  decision: boolean
  sessionId?: string
  sourceNote?: string // ATLAS外 or セッションページ未登録の出典
}

export interface TuktukPhase {
  id: string
  label: string
  events: TuktukEvent[]
}

export const PHASES: TuktukPhase[] = [
  {
    id: "phase-0",
    label: "Phase 0｜構想",
    events: [
      {
        date: "2011年頃（推測）",
        type: "報告",
        summary:
          "駅前再整備を進めるべきとの提言（広報しんとく No.823 P4に記載）",
        decision: false,
        sourceNote: "広報しんとく No.823 P4",
      },
    ],
  },
  {
    id: "phase-1",
    label: "Phase 1｜駅前広場整備（前段）",
    events: [
      {
        date: "2022-06-04",
        type: "契約",
        summary:
          "街路事業工事（駅前広場）工事請負契約の締結（議案第50号）",
        decision: true,
        sourceNote: "giketsu_index（令和4年定例第2回）※ATLASセッション未登録",
      },
      {
        date: "2023-06-02",
        type: "契約",
        summary:
          "街路事業工事（駅前広場再整備）工事請負契約の締結（議案第48号）",
        decision: true,
        sourceNote: "giketsu_index（令和5年定例第2回）※ATLASセッション未登録",
      },
      {
        date: "2023-12-05",
        type: "契約",
        summary: "同 契約変更（議案第66号）",
        decision: false,
        sourceNote: "giketsu_index（令和5年定例第4回）※ATLASセッション未登録",
      },
    ],
  },
  {
    id: "phase-2",
    label: "Phase 2｜駅前複合施設の建設",
    events: [
      {
        date: "2024-06-04",
        type: "報告",
        summary: "駅前複合施設（総額11億円超）の着工開始が議会で確認",
        decision: false,
        sessionId: "r6-2024-06-regular-2",
      },
      {
        date: "2024-12-02",
        type: "契約",
        summary:
          "複合施設建設工事の契約変更（建築主体／電気設備）が議会承認（議案第73号・74号）",
        decision: false,
        sessionId: "r6-2024-12-regular-4",
      },
    ],
  },
  {
    id: "phase-3",
    label: "Phase 3｜制度化（決定点）",
    events: [
      {
        date: "2025-03-19",
        type: "議案",
        summary:
          "施設の設置及び管理に関する条例の制定（議案第15号）",
        decision: true,
        sessionId: "r7-2025-03-regular-1",
      },
      {
        date: "2025-03-19",
        type: "運営",
        summary: "指定管理者の指定（議案第16号）",
        decision: true,
        sessionId: "r7-2025-03-regular-1",
      },
    ],
  },
  {
    id: "phase-4",
    label: "Phase 4｜開所と運営論点",
    events: [
      {
        date: "2025-03-17",
        type: "予算",
        summary:
          "予算審査特別委員会で、交流施設「トクトク」のソフト事業継続財源等が論点化",
        decision: false,
        sessionId: "r7-2025-03-yosan-tokubetsu",
      },
      {
        date: "2025-06-15",
        type: "開所",
        summary: "開所（広報しんとく No.823 特集）",
        decision: false,
        sourceNote: "広報しんとく No.823",
      },
      {
        date: "2025-09-12",
        type: "質問",
        summary:
          "大型事業による借金増への指摘と町側説明（決算特別委員会）",
        decision: false,
        sessionId: "r7-2025-09-kessan-tokubetsu",
      },
      {
        date: "2025-12-02",
        type: "質問",
        summary:
          "地域交流センター「特」の位置づけ（観光拠点 vs 日常利用）が論点として記録",
        decision: false,
        sessionId: "r7-2025-12-regular-4",
      },
    ],
  },
]

export const NAME_VARIANTS = [
  "駅前複合施設",
  "駅前周辺再整備複合施設",
  "新得駅前地域交流センター",
  "とくとく／トクトク／TUKTUK／「特」",
]

export const FACILITY = {
  openDate: "2025-06-15",
  floorArea: "1,315.17㎡",
  projectCost: "10億5,323万円",
  source: "広報しんとく No.823",
}

export const UNRESOLVED = [
  "複合施設建設工事の「契約締結」議案（契約変更は確認済）",
  "実施設計業務委託契約に関する議会記録",
  "指定管理者の具体名と選定プロセス（議案第16号の精読が必要）",
  "令和5年以前（構想〜説明会等）の議会報告の有無（ATLASセッション未収録領域）",
]
