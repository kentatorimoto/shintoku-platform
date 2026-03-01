import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About | Shintoku Atlas",
  description: "Shintoku Atlas は、新得町の意思決定を可視化するための実験的なプロジェクトです。",
}

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">

      {/* タイトル */}
      <div className="mb-16 mt-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
          町を構造として読む。
        </h1>
        <p className="text-textMain/70 text-lg leading-relaxed">
          SHINTOKU ATLAS は、<br />
          新得町の意思決定を可視化するための実験的なプロジェクトです。
        </p>
        <p className="text-textMain/70 text-lg leading-relaxed mt-5">
          ニュースでもなく、<br />
          単発の出来事でもなく、<br />
          時間をかけて積み上がる「決まり方」に目を向けます。
        </p>
      </div>

      {/* なぜつくるのか */}
      <section className="mb-14">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">なぜつくるのか</p>
        <div className="space-y-5 text-textMain/70 leading-relaxed">
          <p>
            町の未来は、<br />
            どこかで一度に決まるものではなく、<br />
            話し合いと見直しの繰り返し、<br />
            そうした小さな選択の積み重ねが、<br />
            少しずつ方向を形づくっていくように見えます。
          </p>
          <p>
            けれど、その「流れ」は、<br />
            日々の情報の中ではなかなか見えません。
          </p>
          <p>
            SHINTOKU ATLAS は、<br />
            その見えにくさを、ほんの少し減らせないかと考えた試みです。
          </p>
        </div>
      </section>

      {/* 何をしているか */}
      <section className="mb-14">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">何をしているか</p>
        <ul className="space-y-2 text-textMain/70 leading-relaxed mb-6">
          {[
            "議会アーカイブの整理",
            "議決データの構造化",
            "継続して議論されている論点の抽出",
            "意思決定プロセスの可視化",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-textSub/40 shrink-0 mt-0.5">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-5 text-textMain/70 leading-relaxed">
          <p>
            意見を示すことよりも、<br />
            まず構造を示すこと。
          </p>
          <p>
            そこから考えるための材料を、<br />
            静かに並べることを目的としています。
          </p>
        </div>
      </section>

      {/* 立場について */}
      <section className="mb-14">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">立場について</p>
        <div className="space-y-5 text-textMain/70 leading-relaxed">
          <p>
            このサイトは、<br />
            特定の政策や立場を支持するものではありません。
          </p>
          <p>
            評価の前に、<br />
            まず流れを見る。
          </p>
          <p>
            SHINTOKU ATLAS は、<br />
            そのための観測装置のような存在でありたいと考えています。
          </p>
        </div>
      </section>

      {/* データについて */}
      <section className="mb-14">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">データについて</p>
        <div className="space-y-5 text-textMain/70 leading-relaxed">
          <p>
            本サイトは、新得町が公開している<br />
            議会資料・記録・動画アーカイブをもとに構成しています。
          </p>
          <p>
            内容に誤りや不足があれば、<br />
            都度修正・更新していきます。
          </p>
        </div>
      </section>

      {/* 実験として */}
      <section className="mb-16">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">実験として</p>
        <div className="space-y-5 text-textMain/70 leading-relaxed">
          <p>
            SHINTOKU ATLAS は、進行中のプロジェクトです。<br />
            より見やすく、より考えやすく、<br />
            構造を捉えるための方法を探りながら、<br />
            少しずつ形を整えています。
          </p>
        </div>
      </section>

    </div>
  )
}
