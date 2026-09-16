"use client"

import { useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"

interface Props {
  /** セッションごとのタグ。並びは一覧の描画順と同じ */
  sessionTags: string[][]
  /** 一覧に出しうるタグを表示順で */
  allTags: string[]
}

/**
 * 会期一覧の絞り込み。
 *
 * 一覧そのものはサーバーで描く。ここはタグの選択状態だけを持つ小さなクライアント
 * コンポーネントで、絞り込みは <style> を1枚差し込んで CSS で行う。
 *
 * こうしているのは、`useSearchParams()` を使うと Next.js が最寄りの Suspense 境界の
 * フォールバックを静的HTMLに出すため。以前は一覧ごとこの内側にあり、ハイドレーションが
 * 終わるまで「読み込み中…」のままだった（本番で 7〜56秒）。境界を絞り込みUIだけに
 * 縮めれば、一覧は最初のHTMLに入るので即座に読める。
 */
export default function SessionFilter({ sessionTags, allTags }: Props) {
  const searchParams = useSearchParams()
  const initialTag = searchParams.get("tag")

  const [selected, setSelected] = useState<string[]>(() => (initialTag ? [initialTag] : []))
  // タグ指定で来たときだけ開いた状態にする（何で絞られているか分からないまま件数が
  // 減っていると、記録が欠けているように見えるため）。
  const [open, setOpen] = useState(Boolean(initialTag))

  function toggle(tag: string) {
    setSelected(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  const shown = useMemo(
    () => (selected.length === 0 ? sessionTags.length : sessionTags.filter(tags => selected.every(t => tags.includes(t))).length),
    [sessionTags, selected]
  )

  // 選んだタグを1つでも持たない行を隠す。1タグ＝1ルールなので、重なれば AND になる。
  // タグは validateTags を通った固定語彙なので、属性セレクタに直接入れてよい。
  const css = selected.map(t => `[data-session-row]:not([data-tags~="${t}"]){display:none}`).join("")

  return (
    <>
      {selected.length > 0 && <style dangerouslySetInnerHTML={{ __html: css }} />}

      <details
        className="group mt-6"
        open={open}
        onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="flex items-center gap-2 cursor-pointer list-none py-1
                            text-[12.5px] font-bold text-textMuted hover:text-textMain transition-colors">
          <span>テーマで絞り込む</span>
          {selected.length > 0 && (
            <span className="mono text-[11px] text-accent">
              {shown}件を表示中
            </span>
          )}
          <span className="mono text-[11px] text-textMuted group-open:hidden">開く ↓</span>
          <span className="mono text-[11px] text-textMuted hidden group-open:inline">閉じる ↑</span>
        </summary>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setSelected([])}
            className={`px-3 py-2 rounded-[3px] text-sm font-medium transition-colors border ${
              selected.length === 0
                ? "bg-accent text-onAccent border-accent"
                : "bg-ink border-lineStrong text-textMuted hover:border-accent hover:text-textMain"
            }`}
          >
            すべて
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              className={`px-3 py-2 rounded-[3px] text-sm font-medium transition-colors border ${
                selected.includes(tag)
                  ? "bg-accent text-onAccent border-accent"
                  : "bg-ink border-lineStrong text-textMuted hover:border-accent hover:text-textMain"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {selected.length > 0 && (
          <p className="text-[12px] text-textMuted mt-3">
            選んだテーマをすべて含む会期だけを出しています（AND 条件）。
            {shown === 0 && "　いまの条件に当てはまる会期はありません。"}
          </p>
        )}
      </details>
    </>
  )
}
