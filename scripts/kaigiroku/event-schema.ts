// ekimae.events.json の型と語彙。定義の説明は docs/trace-events-schema.md。

export const LAYERS = ["fact", "interpretation", "debate"] as const
export type Layer = (typeof LAYERS)[number]

export const OBJECTS = ["とくとく本体", "温浴宿泊施設", "町営浴場", "金融機関", "指定管理", "駅前広場"] as const
export type TraceObject = (typeof OBJECTS)[number]

/** 行為の語彙。上にあるものを優先する（「白紙」と「計画」が同じ文にあれば白紙） */
export const ACTION_PHRASES: { action: string; phrases: string[] }[] = [
  { action: "白紙", phrases: ["白紙", "取りやめ", "取り止め", "中止", "断念", "撤回"] },
  { action: "延期", phrases: ["延期", "先送り", "見送り", "遅れ", "遅延", "ずれ込", "繰り越", "以降になる"] },
  { action: "議決", phrases: ["可決", "否決", "承認されました", "認定されました"] },
  { action: "増額", phrases: ["増額", "増となって", "インフレスライド", "スライド"] },
  { action: "減額", phrases: ["減額"] },
  { action: "契約変更", phrases: ["契約の変更", "変更契約", "契約変更", "契約金額を"] },
  { action: "契約", phrases: ["工事請負契約", "契約の締結", "契約を締結", "契約"] },
  { action: "開所", phrases: ["オープン", "開所", "開業", "供用", "開館"] },
  { action: "閉鎖", phrases: ["閉館", "解体", "閉鎖"] },
  { action: "着工", phrases: ["着工", "着手"] },
  { action: "完成", phrases: ["完成", "竣工"] },
  { action: "条例制定", phrases: ["条例の制定", "条例を制定", "設置条例"] },
  { action: "指定", phrases: ["指定管理者の指定", "指定管理者に指定", "指定期間"] },
  { action: "用地取得", phrases: ["土地の購入", "土地購入", "用地買収", "土地の寄付", "移転補償"] },
  { action: "予算計上", phrases: ["計上", "委託料", "補助金", "補助事業", "予算"] },
  { action: "調査", phrases: ["調査", "ニーズ", "アイデア"] },
  { action: "計画", phrases: ["基本計画", "実施計画", "実施設計", "概略設計", "基本設計", "スケジュール", "計画", "予定"] },
  { action: "構想", phrases: ["基本構想", "構想"] },
]
/** 上の語に当たらないときの受け皿。行為を特定できたわけではないので、件数は別に報告する */
export const FALLBACK_ACTION = { debate: "質問", interpretation: "説明" } as const
export const ACTIONS = [...ACTION_PHRASES.map(a => a.action), ...Object.values(FALLBACK_ACTION)]

export const MEMBER_ROLE = /^(議員|委員)$/
export const CHAIR_ROLE = /^(議長|副議長|臨時議長|委員長|副委員長|臨時委員長|議会運営委員長)$/

export interface EventCause {
  /** 理由として述べられた部分（原文） */
  reason: string
  /** 理由とつなぐ語（ことから・の影響で 等） */
  marker: string
  /** 理由に続く結果の部分（原文） */
  effect: string
  /** 述べた文に推量の語があれば 推測 */
  certainty: "断定" | "推測"
  /** 述者自身の説明ではなく、他者の説明や文書を引いたもの（議員が町の説明を引く場合など） */
  hearsay: boolean
  /** 理由が event の一文の中にあるか、同じ発言の直前の文にあるか */
  scope: "同じ文" | "前の文"
  /** 町の説明か議員の主張かは layer と actor で読む */
  stated_by: string
}

export interface TraceEvent {
  id: string
  layer: Layer
  action: string | null
  /** 行為を決めた原文の語。受け皿のときは null */
  action_phrase: string | null
  /** その行為が実施済みか予定か。文から読み取れなければ null */
  tense: "実施" | "予定" | null
  actor: { name: string; role: string }
  objects: TraceObject[]
  /** object をどこから決めたか。parent は生成結果の分類を流用したもの */
  object_source: "text" | "parent" | null
  /** 発言した日 */
  date: string
  /** 発言とは別の日の出来事として生成結果が置いた日（例: 6/2 の報告が述べた 6/15 の開所） */
  stated_date: string | null
  amounts: { raw: string; yen: number; approx: boolean }[]
  causes: EventCause[]
  source: {
    /** 抜粋ID。抜粋に無い議決の発言は null */
    excerpt_id: string | null
    session_key: string
    /** speeches.json の添字（0始まり） */
    speech_index: number
    page: number
    url: string
    agenda: string
    quote: string
    /** quote を含む一文（原文） */
    sentence: string
  }
  /** 議案番号と採決結果。speeches.json から確かめられたものだけ */
  bill: string | null
  result: string | null
  /** 同じ事柄を並べるためのまとまり。寄せずに別の event のまま持つ */
  groups: string[]
  derived_from: { section: string; title: string }[]
}
