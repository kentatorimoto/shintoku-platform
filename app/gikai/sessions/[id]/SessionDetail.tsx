"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

// ── 型定義 ─────────────────────────────────────────────────────────────────
interface Part {
  label:     string
  youtube:   string | null
  pdfPath:   string | null
  images:    string[]   // /slides/{sessionId}/{slidesDir}/page-NNN.jpg
  slidesDir?: string
}

interface QnaItem {
  speaker_name:      string
  speaker_role:      string
  topic_title:       string
  topic_tags:        string[]
  question_points:   string[]
  answer_summary:    string
  answer_points:     string[]
  conclusion:        string
  continuing_issues: string[]
}

interface BillQuestion {
  questioner: string
  content:    string
  answer:     string
}

interface BillItem {
  bill_number:           string
  bill_title:            string
  bill_tags:             string[]
  summary:               string
  proposer:              string
  questions:             BillQuestion[]
  result:                string
  result_detail:         string
  referred_to_committee: boolean
}

interface CommitteeReferral {
  bill_numbers: string[]
  committee:    string
  note:         string
}

interface HonkaigiData {
  session_id:           string
  part_index:           number
  session_date:         string
  part_type:            "honkaigi"
  source_url:           string
  items:                BillItem[]
  committee_referrals:  CommitteeReferral[]
}

interface Props {
  sessionId:         string
  parts:             Part[]
  initialPartIndex?: number
  qnaItems?:         QnaItem[] | null
  honkaigiData?:     HonkaigiData | null
}

// ── 本会議・議案アコーディオン ────────────────────────────────────────────────
function HonkaigiSection({ data }: { data: HonkaigiData }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const INITIAL_COUNT = 5
  const visibleItems = showAll ? data.items : data.items.slice(0, INITIAL_COUNT)
  const hasMore = data.items.length > INITIAL_COUNT

  return (
    <section>
      <h2 className="text-sm font-semibold text-textSub tracking-widest mb-4">
        議案審議
      </h2>
      <div className="space-y-2">
        {visibleItems.map((item, i) => {
          const isOpen = openIndex === i
          return (
            <div key={item.bill_number} className="bg-ink border border-line rounded-[3px] overflow-hidden">
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-line/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {item.bill_tags.map(tag => (
                      <span key={tag} className="text-xs border border-line text-textSub/70 px-2 py-0.5 rounded-[3px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="font-mincho text-[15px] font-bold text-textMain mb-1">{item.bill_title}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-textSub/60">{item.bill_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-[3px] border ${
                      item.result === "可決"
                        ? "border-accent/40 text-accent/70"
                        : "border-line text-textSub/60"
                    }`}>
                      {item.result}
                    </span>
                  </div>
                </div>
                <svg
                  className={`w-4 h-4 text-textSub/40 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-line/50">
                  <dl className="space-y-3 mt-4">
                    <div className="flex gap-3">
                      <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0 pt-0.5 w-16">概要</dt>
                      <dd className="text-sm text-textMain/80 leading-relaxed">{item.summary}</dd>
                    </div>
                    <div className="border-t border-line/50 pt-3 flex gap-3">
                      <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0 pt-0.5 w-16">提案者</dt>
                      <dd className="text-sm text-textMain/80">{item.proposer}</dd>
                    </div>
                    {item.questions.length > 0 && (
                      <div className="border-t border-line/50 pt-3 flex gap-3">
                        <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0 pt-0.5 w-16">質疑</dt>
                        <dd className="space-y-3 flex-1">
                          {item.questions.map((q, j) => (
                            <div key={j} className="text-sm">
                              <p className="text-textSub/70 text-xs mb-1">{q.questioner}</p>
                              <p className="text-textMain/80 leading-relaxed mb-1">{q.content}</p>
                              <p className="text-textSub/60 leading-relaxed text-xs border-l border-line/50 pl-3">{q.answer}</p>
                            </div>
                          ))}
                        </dd>
                      </div>
                    )}
                    <div className="border-t border-line/50 pt-3 flex gap-3">
                      <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0 pt-0.5 w-16">採決</dt>
                      <dd className="text-sm text-textMain/80">{item.result}（{item.result_detail}）</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          )
        })}

        {hasMore && (
          <button
            onClick={() => {
              setShowAll(!showAll)
            }}
            className="mt-4 w-full py-3 text-sm text-textSub/60 border border-line rounded-[3px] hover:border-accent/50 hover:text-accent transition-colors"
          >
            {showAll
              ? "折りたたむ"
              : `残り ${data.items.length - INITIAL_COUNT} 件を表示`}
          </button>
        )}

        {data.committee_referrals.length > 0 && (
          <div className="bg-ink border border-line/30 rounded-[3px] px-5 py-4">
            {data.committee_referrals.map((ref, i) => (
              <div key={i}>
                <p className="text-xs text-textSub/60 mb-1">{ref.bill_numbers.join("、")} → {ref.committee}に付託</p>
                <p className="text-xs text-textSub/40">{ref.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ── 一般質問アコーディオン ────────────────────────────────────────────────────
function QnaSection({ items }: { items: QnaItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

  const INITIAL_COUNT = 5
  const visibleItems = showAll ? items : items.slice(0, INITIAL_COUNT)
  const hasMore = items.length > INITIAL_COUNT

  const sectionLabel = items[0]?.speaker_role?.includes("委員")
    ? "予算審査 — 項目ごとの質疑"
    : "一般質問 — 議員ごとの質疑"

  return (
    <section>
      <h2 className="text-sm font-semibold text-textSub tracking-widest mb-4">
        {sectionLabel}
      </h2>
      <div className="space-y-2">
        {visibleItems.map((item, i) => {
          const isOpen = openIndex === i
          return (
            <div key={item.speaker_name + i} className="bg-ink border border-line rounded-[3px] overflow-hidden">
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-line/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {item.topic_tags.map(tag => (
                      <span key={tag} className="text-xs border border-line text-textSub/70 px-2 py-0.5 rounded-[3px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="font-mincho text-[15px] font-bold text-textMain mb-1">{item.topic_title}</p>
                  <p className="text-xs text-textSub/60">{item.speaker_name} {item.speaker_role}</p>
                </div>
                <svg
                  className={`w-4 h-4 text-textSub/40 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-line/50">
                  <dl className="space-y-3 mt-4">
                    <div className="flex gap-3">
                      <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0 pt-0.5 w-16">質問</dt>
                      <dd className="text-sm text-textMain/80 leading-relaxed">
                        <ul className="space-y-1">
                          {item.question_points.map((p, j) => (
                            <li key={j} className="flex gap-2">
                              <span className="text-textSub/40 shrink-0">·</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    <div className="border-t border-line/50 pt-3 flex gap-3">
                      <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0 pt-0.5 w-16">行政の回答</dt>
                      <dd className="text-sm text-textMain/80 leading-relaxed">{item.answer_summary}</dd>
                    </div>
                    <div className="border-t border-line/50 pt-3 flex gap-3">
                      <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0 pt-0.5 w-16">結論</dt>
                      <dd className="text-sm text-textMain/80 leading-relaxed">{item.conclusion}</dd>
                    </div>
                    {item.continuing_issues.length > 0 && (
                      <div className="border-t border-line/50 pt-3 flex gap-3">
                        <dt className="text-xs text-textSub/60 whitespace-nowrap shrink-0 pt-0.5 w-16">継続課題</dt>
                        <dd className="text-sm text-textSub/70 leading-relaxed">
                          {item.continuing_issues.join("　")}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => {
            setShowAll(!showAll)
            setOpenIndex(null)
          }}
          className="mt-4 w-full py-3 text-sm text-textSub/60 border border-line rounded-[3px] hover:border-accent/50 hover:text-accent transition-colors"
        >
          {showAll
            ? "折りたたむ"
            : `残り ${items.length - INITIAL_COUNT} 件を表示`}
        </button>
      )}
    </section>
  )
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
      className="flex items-center gap-3 bg-ink border border-line rounded-[3px] p-4
                 hover:border-accent/50 transition-all group"
    >
      {/* サムネイル */}
      <div className="relative w-24 h-14 sm:w-28 sm:h-16 shrink-0 rounded-[3px] overflow-hidden bg-line">
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
        <p className="text-[11px] font-semibold tracking-widest text-accent/70 mb-0.5">
          YouTube
        </p>
        <p className="text-sm font-semibold text-textMain group-hover:text-accent transition-colors">
          {label}
        </p>
        <p className="text-[11px] text-textSub/50 mt-0.5">
          YouTube で見る →
        </p>
      </div>

      {/* 外部リンクアイコン */}
      <svg className="w-4 h-4 text-textSub/30 shrink-0 group-hover:text-accent/50 transition-colors"
           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

export default function SessionDetail({ sessionId, parts, initialPartIndex = 0, qnaItems, honkaigiData }: Props) {
  const [activeIdx, setActiveIdx] = useState(initialPartIndex)
  const topRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  if (parts.length === 0) {
    return <p className="text-textSub/50 text-sm">コンテンツがありません</p>
  }

  const activePart = parts[activeIdx]

  function handleTabChange(i: number) {
    setActiveIdx(i)
    router.push(`/gikai/sessions/${sessionId}/${i}`)
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
                "px-4 py-2 rounded-[3px] text-sm font-medium transition-colors border",
                activeIdx === i
                  ? "bg-accent/10 text-accent border-accent font-semibold"
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

      {/* ── 本会議・議案 ──────────────────────────────────────────── */}
      {honkaigiData && honkaigiData.items.length > 0 && (
        <HonkaigiSection data={honkaigiData} />
      )}

      {/* ── 一般質問 ─────────────────────────────────────────────── */}
      {qnaItems && qnaItems.length > 0 && (
        <QnaSection items={qnaItems} />
      )}

      {/* ── スライド（画像があるパートのみ表示）─────────────────────────── */}
      {activePart.images.length > 0 && (
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
                         rounded-[3px] px-3 py-2 bg-ink shrink-0"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9
                         2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/>
              </svg>
              PDF を開く
            </a>
          )}
        </div>

        <div className="space-y-3 max-w-4xl mx-auto">
            {activePart.images.map((src, i) => (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative rounded-[3px] overflow-hidden
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
      </section>
      )}
    </div>
  )
}
