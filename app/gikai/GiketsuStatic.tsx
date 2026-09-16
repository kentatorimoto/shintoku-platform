import Link from "next/link"
import { LABELS } from "@/lib/labels"
import GiketsuRow from "./GiketsuRow"
import { PAGE_SIZE, flattenItems, linkKey, type GikaiLinks, type GiketsuSession } from "./types"

interface Props {
  sessions: GiketsuSession[]
  links:    GikaiLinks
}

/**
 * 絞り込みが効く前の、素の一覧。
 *
 * これは GiketsuBrowser の Suspense フォールバックとして使う。
 * useSearchParams() を使うコンポーネントは静的プリレンダ時にフォールバックが
 * HTMLに出るので、**フォールバックを「読み込み中」ではなく本物の記録にすれば、
 * 一覧が最初のHTMLに入る。**
 *
 * markup は GiketsuBrowser の初期状態（絞り込みなし・先頭100件）と同じにしてある。
 * ハイドレーション後に入れ替わっても見た目は動かない。
 */
export default function GiketsuStatic({ sessions, links }: Props) {
  const items = flattenItems(sessions)
  const activeSessions = sessions.filter(s => s.items.length > 0)
  const visible = items.slice(0, PAGE_SIZE)

  return (
    <>
      {/* ── 直近セッション（top 3） ───────────────────────── */}
      {activeSessions.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textMuted mb-3">最近の会議</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {activeSessions.slice(0, 3).map(session => (
              <div key={session.sessionName} className="text-left bg-ink border border-line rounded-[3px] p-4">
                <div className="text-accent text-xs font-semibold mb-0.5">{session.eraLabel}</div>
                <div className="text-textMain font-semibold text-base">{session.sessionLabel}</div>
                {session.sessionRange && (
                  <div className="text-textMuted text-sm mt-1">{session.sessionRange}</div>
                )}
                <div className="text-textMuted text-sm mt-2">{session.items.length} 件</div>
                {session.sessionId && (
                  <Link
                    href={`/gikai/sessions/${session.sessionId}`}
                    className="inline-block mt-3 text-xs text-accent transition-colors"
                  >
                    論点・争点を読む →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 検索窓（ハイドレーション前は入力できない）───────── */}
      <section className="mb-6 space-y-3">
        <div className="relative">
          <input
            type="text"
            enterKeyHint="search"
            placeholder="件名・議案番号・会議名で検索…"
            defaultValue=""
            style={{ fontSize: "16px" }}
            className="w-full bg-ink border border-line rounded-[3px] px-4 py-3 pr-10 text-textMain placeholder-textMuted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="py-1 text-[12.5px] font-bold text-textMuted">絞り込み</div>
      </section>

      {/* ── 件数 ─────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between border-t-[1.5px] border-textMain pt-4 pb-3 mb-1">
        <h2 className="text-[12.5px] font-bold tracking-[0.1em] text-textMuted">
          {LABELS.giketsu.formal}の一覧
        </h2>
        <p className="text-textMuted text-[13px]">
          <span className="mono font-bold text-2xl md:text-[26px] text-textMain leading-none">
            {items.length.toLocaleString()}
          </span>
          <span className="ml-1.5">件</span>
        </p>
      </div>

      {/* ── リスト（先頭 PAGE_SIZE 件）──────────────────────── */}
      <div className="space-y-2">
        {visible.map(item => (
          <GiketsuRow key={`${item.eraLabel}-${item.caseType}-${item.num}`} item={item} refs={links[linkKey(item)] ?? []} />
        ))}
      </div>

      {items.length > visible.length && (
        <div className="mt-6 text-center">
          <span className="inline-block px-6 py-3 border border-line rounded-[3px] text-textMuted text-sm">
            さらに表示（残り {(items.length - visible.length).toLocaleString()} 件）
          </span>
        </div>
      )}
    </>
  )
}
