import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About | Shintoku Atlas",
  description: "新得町の議会・議決・プロセスを構造化し、意思決定の流れを記録するプロジェクト。",
}

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">

      <div className="mt-16 mb-16">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-10">
          SHINTOKU ATLAS
        </h1>

        <div className="space-y-8 text-textMain/70 leading-relaxed text-base">
          <p>
            新得町の議会・議決・プロセスを構造化し、<br />
            「どう決まっていくか」を記録する非公式の個人プロジェクトです。
          </p>

          <p>
            ニュースではなく、流れを見る。<br />
            断片ではなく、構造を見る。<br />
            そのための観測装置として、静かに存在することを目指しています。
          </p>

          <p>
            特定の政策や立場を支持しません。<br />
            新得町が公開している議会資料・記録・動画をもとに構成しています。
          </p>

          <p className="text-textSub/50 text-sm">
            AIによる要約を含むため、内容に誤りがある場合があります。<br />
            誤りや不足があれば、都度修正・更新していきます。
          </p>

          <p className="text-textSub/50 text-sm">
            開発・制作：<a
              href="https://www.office339.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-accent transition-colors"
            >
              office339
            </a>
          </p>
        </div>
      </div>

    </div>
  )
}
