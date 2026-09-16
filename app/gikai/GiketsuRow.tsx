import Link from "next/link"
import { INSIGHT_THEME_LABELS } from "@/lib/labels"
import { ISSUE_LABELS, resultStyle, type FlatItem } from "./types"

interface Props {
  item: FlatItem
  /** gikai_links.json の値（"theme:finance" / "issue:finance-kpi"）。 */
  refs: string[]
}

/**
 * 議案1件の行。
 *
 * サーバー描画版（GiketsuStatic）とクライアント版（GiketsuBrowser）の両方から使う。
 * 片方だけ直すとハイドレーション後に見た目が変わるので、行の markup はここ1箇所に置く。
 * "use client" は付けない — サーバーからもクライアントからも import できる。
 */
export default function GiketsuRow({ item, refs }: Props) {
  return (
    <div>
      <a
        href={item.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-ink border border-line rounded-[3px] p-4 hover:border-accent transition-all group"
      >
        <div className="flex items-start gap-3">
          {/* 左：種別+番号 */}
          <div className="shrink-0 pt-0.5">
            <span className="inline-flex items-baseline gap-1 text-xs border border-line rounded-[3px] px-2 py-1 text-textMuted">
              {item.caseType}
              <span className="mono text-textMain font-bold">{item.num}</span>
            </span>
          </div>

          {/* 中：件名 + メタ */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-base md:text-lg line-clamp-2 transition-colors ${
                item.title ? "text-textMain group-hover:text-accent" : "text-textMuted italic"
              }`}
            >
              {item.title || "（件名なし）"}
            </p>
            <p className="text-textMuted text-[12.5px] mt-1.5">
              <span className="mono">{item.decisionDate}</span>
              <span className="mx-1.5">·</span>
              {item.sessionName}
            </p>
          </div>

          {/* 右：結果バッジ */}
          <div className="shrink-0">
            <span
              className={`inline-block text-xs font-medium border rounded-[3px] px-2 py-0.5 whitespace-nowrap ${resultStyle(item.result)}`}
            >
              {item.result || "—"}
            </span>
          </div>
        </div>
      </a>

      {refs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
          <span className="text-xs text-textMuted shrink-0">関連：</span>
          {refs.map(ref => {
            const sep = ref.indexOf(":")
            const kind = ref.slice(0, sep)
            const id = ref.slice(sep + 1)
            const label =
              kind === "theme"
                ? (INSIGHT_THEME_LABELS[id as keyof typeof INSIGHT_THEME_LABELS] ?? id)
                : (ISSUE_LABELS[id] ?? id)
            const href = kind === "theme" ? `/process?theme=${id}` : `/process/issues?issue=${id}`
            return (
              <Link
                key={ref}
                href={href}
                className="inline-flex items-center text-xs border border-line bg-ink rounded-[3px] px-2 py-0.5 text-textMuted hover:text-accent hover:border-accent transition-colors"
              >
                {label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
