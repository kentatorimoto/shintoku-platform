"use client"

import { useState, useRef } from "react"
import Image from "next/image"

// ── 型定義 ─────────────────────────────────────────────────────────────────
interface Part {
  label:     string
  youtube:   string | null
  pdfPath:   string | null
  images:    string[]   // /slides/{sessionId}/{slidesDir}/page-NNN.jpg
  slidesDir: string
}

interface Props {
  sessionId: string
  parts:     Part[]
}

// ── YouTube 動画 ID 抽出 ────────────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

// ── YouTube カード ──────────────────────────────────────────────────────────
function VideoCard({ youtube, label }: { youtube: string; label: string }) {
  const videoId  = extractVideoId(youtube)
  const thumbUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null

  return (
    <a
      href={youtube}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-ink border border-line rounded-xl p-4
                 hover:border-red-500/50 transition-all group"
    >
      {/* サムネイル */}
      <div className="relative w-24 h-14 sm:w-28 sm:h-16 shrink-0 rounded-lg overflow-hidden bg-line">
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt={`${label}動画サムネイル`}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <svg className="w-8 h-8 text-textSub/40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}
        {/* 再生ボタンオーバーレイ */}
        <div className="absolute inset-0 flex items-center justify-center
                        bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>

      {/* テキスト */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold tracking-widest text-red-400/80 mb-0.5">
          YouTube
        </p>
        <p className="text-sm font-semibold text-textMain group-hover:text-red-400 transition-colors">
          {label}
        </p>
        <p className="text-[11px] text-textSub/50 mt-0.5 truncate">
          {youtube}
        </p>
      </div>

      {/* 外部リンクアイコン */}
      <svg className="w-4 h-4 text-textSub/30 shrink-0 group-hover:text-red-400/50 transition-colors"
           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

export default function SessionDetail({ sessionId, parts }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const topRef = useRef<HTMLDivElement>(null)

  if (parts.length === 0) {
    return <p className="text-textSub/50 text-sm">コンテンツがありません</p>
  }

  const activePart = parts[activeIdx]

  function handleTabChange(i: number) {
    setActiveIdx(i)
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  return (
    <div ref={topRef} className="space-y-8">

      {/* ── タブバー（パートが複数のときだけ表示）────────────────────── */}
      {parts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {parts.map((part, i) => (
            <button
              key={part.slidesDir}
              onClick={() => handleTabChange(i)}
              className={[
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                activeIdx === i
                  ? "bg-accent text-base border-accent"
                  : "bg-ink border-line text-textSub hover:border-accent/50",
              ].join(" ")}
            >
              {part.label}
            </button>
          ))}
        </div>
      )}

      {/* ── 動画 ─────────────────────────────────────────────────────── */}
      {activePart.youtube && (
        <section>
          <h2 className="text-sm font-semibold text-textSub tracking-widest mb-4">
            動画アーカイブ
          </h2>
          <VideoCard youtube={activePart.youtube} label={activePart.label} />
        </section>
      )}

      {/* ── スライド ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-textSub tracking-widest">
            スライド
          </h2>
          {activePart.pdfPath && (
            <a
              href={activePart.pdfPath}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-textSub/70
                         hover:text-accent transition-colors border border-line/50
                         rounded-lg px-3 py-2 bg-ink shrink-0"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9
                         2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
              </svg>
              PDF を開く
            </a>
          )}
        </div>

        {activePart.images.length === 0 ? (
          <div className="bg-ink border border-line rounded-xl p-8 text-center">
            <p className="text-textSub text-sm mb-3">
              スライド画像がまだ生成されていません
            </p>
            <code className="text-xs text-accent/80 bg-line/50 rounded px-3 py-2
                             block w-fit mx-auto whitespace-nowrap overflow-x-auto">
              npm run slides:generate {sessionId} {activePart.slidesDir}
            </code>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {activePart.images.map((src, i) => (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative rounded-xl overflow-hidden
                           border border-line hover:border-accent/50
                           shadow-sm hover:shadow-md transition-all group"
              >
                {/* ページ番号バッジ */}
                <div className="absolute top-2 left-2 z-10
                                bg-ink/80 backdrop-blur-sm rounded-md
                                px-2 py-0.5 text-[10px] font-mono text-textSub/70">
                  {i + 1} / {activePart.images.length}
                </div>

                {/* 拡大アイコン：モバイルは常時表示、desktop はホバーで表示 */}
                <div className="absolute top-2 right-2 z-10
                                opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                                transition-opacity
                                bg-ink/80 backdrop-blur-sm rounded-md px-2 py-1">
                  <svg className="w-3.5 h-3.5 text-textSub" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </div>

                <Image
                  src={src}
                  alt={`スライド ${i + 1} ページ目`}
                  width={2867}
                  height={1600}
                  className="w-full h-auto block"
                  unoptimized
                  priority={i < 2}
                />
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
