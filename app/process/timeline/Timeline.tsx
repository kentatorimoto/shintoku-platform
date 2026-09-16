import Link from "next/link"
import { SESSION_SUMMARY_LABELS } from "@/lib/labels"

// ── 型定義 ─────────────────────────────────────────────────────────────────
interface Summary {
  issues:      string
  conflicts:   string
  nextActions: string
}

export interface GikaiSession {
  id:              string
  officialTitle:   string
  narrativeTitle?: string
  date:            string
  tags:            string[]
  summary?:        Summary
}

interface Props {
  sessions: GikaiSession[]
  /** `?tag=` の値。データに無ければ既定テーマに落ちる。 */
  tag?: string
}

// ── タグ表示順 ──────────────────────────────────────────────────────────────
const TAG_ORDER = [
  "定例会", "臨時会", "特別委員会",
  "当初予算", "補正予算", "決算",
  "インフラ", "農業", "観光", "教育", "文化", "子育て", "財政",
  "物価高騰対策", "総合計画", "エネルギー", "人口政策",
  "争点あり", "修正可決あり",
]

/** 既定で開くテーマ。データに無ければ先頭のタグに落ちる。 */
const DEFAULT_TAG = "エネルギー"

/** 日付は全ページ共通でドット区切りの等幅（2026.09.01）。 */
const toDot = (iso: string) => iso.replace(/-/g, ".")

/**
 * 意思決定タイムライン。
 *
 * もとはクライアントコンポーネントで、テーマの選択を useState で持っていた。
 * そのためページが `searchParams` を読む必要があり、静的プリレンダ時に
 * Suspense のフォールバック（「読み込み中…」）だけがHTMLに出ていた。
 *
 * テーマの選択はリンク（`?tag=`）にしてサーバーで解決する。
 * /process・/process/issues・/process/priorities から `?tag=` で入ってくるので、
 * URLが状態を持つ形の方がもともと素直だった。
 */
export default function Timeline({ sessions, tag }: Props) {
  const inData = new Set(sessions.flatMap(s => s.tags))
  const ordered = TAG_ORDER.filter(t => inData.has(t))
  const rest = [...inData].filter(t => !TAG_ORDER.includes(t)).sort()
  const allTags = [...ordered, ...rest]

  const selectedTag =
    tag && allTags.includes(tag) ? tag
    : allTags.includes(DEFAULT_TAG) ? DEFAULT_TAG
    : (allTags[0] ?? "")

  const filtered = sessions
    .filter(s => s.tags.includes(selectedTag))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <>
      {/* ── テーマ選択（単一選択・URLが状態を持つ） ─────────────────── */}
      <div className="mb-10 flex flex-wrap gap-2">
        {allTags.map(t => (
          <Link
            key={t}
            href={`/process/timeline?tag=${encodeURIComponent(t)}`}
            scroll={false}
            className={`px-3 py-2 rounded-[3px] text-sm font-medium transition-colors border ${
              selectedTag === t
                ? "bg-accent text-onAccent border-accent"
                : "bg-ink border-line text-textMuted hover:border-accent hover:text-textMain"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {/* ── タイムライン ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="text-textMuted text-center py-20">このテーマの記録はまだありません</p>
      ) : (
        <div className="space-y-0">
          {filtered.map((session, i) => {
            const isLast = i === filtered.length - 1
            return (
              <div key={session.id} className="flex gap-5">
                {/* ── 左レール ── */}
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <div className="w-[11px] h-[11px] rounded-full bg-accent border-[1.5px] border-accent shrink-0" /> {/* contrast-ok: タイムラインの節点。文字は載らない */}
                  {!isLast && <div className="w-px flex-1 bg-line mt-2 mb-0" />}
                </div>

                {/* ── 会議カード ── */}
                <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-8"}`}>
                  <p className="mono text-xs text-accent font-semibold tracking-wide mb-2">
                    {toDot(session.date)}
                  </p>
                  <div className="bg-ink border border-line rounded-[3px] p-5 hover:border-accent transition-all group">
                    <h3 className="text-base md:text-lg font-semibold text-textMain
                                   group-hover:text-accent transition-colors leading-snug mb-1">
                      {session.narrativeTitle ?? session.officialTitle}
                    </h3>
                    {session.narrativeTitle && (
                      <p className="text-xs text-textMuted mb-3 leading-snug">{session.officialTitle}</p>
                    )}
                    {session.summary && (
                      <dl className="mb-4 space-y-2">
                        {([
                          { key: "issues",      label: SESSION_SUMMARY_LABELS.issues,      dd: session.summary.issues },
                          { key: "conflicts",   label: SESSION_SUMMARY_LABELS.conflicts,   dd: session.summary.conflicts },
                          { key: "nextActions", label: SESSION_SUMMARY_LABELS.nextActions, dd: session.summary.nextActions },
                        ] as const).map(({ key, label, dd }) => dd && (
                          <div key={key}>
                            <dt className="text-[11.5px] font-bold text-textMuted">{label.text}</dt>
                            <dd className="text-sm leading-relaxed text-textSub break-words mt-0.5">{dd}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <Link
                      href={`/gikai/sessions/${session.id}`}
                      className="inline-flex items-center text-xs text-accent transition-colors"
                    >
                      会議を読む →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
