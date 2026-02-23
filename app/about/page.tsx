import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "About | Shintoku Atlas",
  description: "Shintoku Atlas は、新得町の公開情報を再構造化し、町の意思決定を可視化する非公式アーカイブです。",
}

const SECTIONS = [
  {
    label: "What",
    body: `Shintoku Atlas は、新得町の公開情報を再構造化し、町の意思決定を可視化する非公式アーカイブです。\n\n議会動画、議決結果、計画資料など、公開されている一次情報を整理・再編集し、意思決定の流れを理解しやすい形で提示します。`,
  },
  {
    label: "Why",
    body: `地方自治体の情報は公開されていますが、長時間の動画や分散した資料の形式では、町民が全体像を把握することは容易ではありません。\n\n本サイトは、公開情報を「ニュース」ではなく「構造」として捉え直し、町がどのように意思決定を行っているのかを時系列で読み解くことを目的としています。`,
  },
  {
    label: "How",
    items: [
      "議会動画の整理とセッション単位での再構造化",
      "PDF資料の画像化・閲覧性の向上",
      "会議ごとの要点整理（3行サマリー）",
      "複数会議を横断した論点の抽出と可視化",
    ],
    note: "扱う情報はすべて公開情報に基づいています。",
  },
  {
    label: "Position",
    body: `本サイトは新得町の公式サイトではありません。\n特定の政治的立場を支持・批判するものでもありません。\n\n公開情報を基に、町の意思決定の過程を理解するための実験的なアーカイブとして運営されています。`,
  },
] as const

const CONCEPT = "町を「出来事」として消費するのではなく、「構造」として読み解く。\nShintoku Atlas は、地域の意思決定を地図のように俯瞰するための観測装置です。"

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">

      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <div className="mb-12">
        <Link
          href="/"
          className="text-textSub text-sm hover:text-textMain transition-colors mb-4 inline-block"
        >
          ← トップ
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          About Shintoku Atlas
        </h1>
      </div>

      {/* ── What / Why / How / Position ──────────────────────────────── */}
      <div className="space-y-10 mb-20">
        {SECTIONS.map((section) => (
          <section key={section.label} className="bg-ink border border-line rounded-xl p-6">
            <h2 className="text-xs font-semibold text-textSub/60 tracking-widest uppercase mb-4">
              {section.label}
            </h2>

            {"body" in section && (
              <div className="space-y-4">
                {section.body.split("\n\n").map((para, i) => (
                  <p key={i} className="text-textMain/80 leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            )}

            {"items" in section && (
              <>
                <ul className="space-y-2 mb-4">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-textMain/80">
                      <span className="text-accent shrink-0 mt-0.5">・</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-textSub/60 text-sm">{section.note}</p>
              </>
            )}
          </section>
        ))}
      </div>

      {/* ── Concept（静かに・大きめ） ─────────────────────────────────── */}
      <section className="border-t border-line/40 pt-12">
        <p className="text-xs font-semibold text-textSub/40 tracking-widest uppercase mb-6">
          Concept
        </p>
        <p className="text-lg md:text-xl leading-relaxed text-textMain/60 whitespace-pre-line">
          {CONCEPT}
        </p>
      </section>

    </div>
  )
}
