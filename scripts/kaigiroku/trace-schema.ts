// 論点の流れの構造化出力。build-trace（生成）と render-trace（描画）で共有する。

export const BRANCH_IDS = ["whole", "tokutoku", "onyoku", "yokujo", "kinyu", "shitei"] as const
export type BranchId = (typeof BRANCH_IDS)[number]

export const MILESTONE_KINDS = ["構想", "計画", "予算", "契約", "着工", "開所", "延期", "白紙", "条例", "質問", "報告"] as const

export interface SourceRef { excerpt_id: string; quote: string }
export interface DatedEntry { date: string; text: string; sources: SourceRef[] }

export interface TraceResponse {
  title: string
  first_mention: DatedEntry
  milestones: { date: string; kind: (typeof MILESTONE_KINDS)[number]; branches: BranchId[]; title: string; text: string; sources: SourceRef[] }[]
  branches: { id: BranchId; name: string; text: string; sources: SourceRef[] }[]
  recurring_questions: { question: string; occurrences: DatedEntry[] }[]
  answer_changes: { topic: string; occurrences: DatedEntry[] }[]
  unknowns: string[]
}

const str = { type: "string" }
const obj = (properties: Record<string, unknown>) => ({
  type: "object", additionalProperties: false, properties, required: Object.keys(properties),
})
const arr = (items: unknown) => ({ type: "array", items })
const sources = arr(obj({ excerpt_id: str, quote: str }))
const dated = obj({ date: str, text: str, sources })

export const TRACE_SCHEMA = obj({
  title: str,
  first_mention: dated,
  milestones: arr(obj({
    date: str,
    kind: { type: "string", enum: [...MILESTONE_KINDS] },
    branches: arr({ type: "string", enum: [...BRANCH_IDS] }),
    title: str,
    text: str,
    sources,
  })),
  branches: arr(obj({ id: { type: "string", enum: [...BRANCH_IDS] }, name: str, text: str, sources })),
  recurring_questions: arr(obj({ question: str, occurrences: arr(dated) })),
  answer_changes: arr(obj({ topic: str, occurrences: arr(dated) })),
  unknowns: arr(str),
})
