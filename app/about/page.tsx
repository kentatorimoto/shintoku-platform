import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About | Shintoku Atlas",
  description: "Shintoku Atlas は、新得町の意思決定を可視化するための独立したプロジェクトです。",
}

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">

      {/* タイトル */}
      <div className="mb-16 mt-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
          町を、構造として読む。
        </h1>
        <p className="text-textMain/70 text-lg leading-relaxed">
          SHINTOKU ATLAS は、<br />
          新得町の意思決定を可視化するための独立したプロジェクトです。
        </p>
        <p className="text-textMain/70 text-lg leading-relaxed mt-5">
          ニュースではなく、<br />
          単発の出来事でもなく、<br />
          時間をかけて積み上がる「決まり方」を記録します。
        </p>
      </div>

      {/* なぜつくるのか */}
      <section className="mb-14">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">なぜつくるのか</p>
        <div className="space-y-5 text-textMain/70 leading-relaxed">
          <p>
            町の未来は、<br />
            ある日突然決まるわけではありません。
          </p>
          <p>
            会議、議論、修正、継続審査。<br />
            小さな選択の連続が、<br />
            やがて大きな方向性になります。
          </p>
          <p>
            その流れは、<br />
            通常は見えません。
          </p>
          <p>
            SHINTOKU ATLAS は、<br />
            その「見えにくさ」を減らすための試みです。
          </p>
        </div>
      </section>

      {/* 何をしているか */}
      <section className="mb-14">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">何をしているか</p>
        <ul className="space-y-2 text-textMain/70 leading-relaxed mb-6">
          {[
            "議会アーカイブの整理",
            "議決結果の構造化",
            "継続論点の抽出",
            "意思決定プロセスの可視化",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-textSub/40 shrink-0 mt-0.5">—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-textMain/70 leading-relaxed">
          立場を示すのではなく、<br />
          構造を示すことを目的としています。
        </p>
      </section>

      {/* 立場について */}
      <section className="mb-14">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">立場について</p>
        <div className="space-y-5 text-textMain/70 leading-relaxed">
          <p>
            このサイトは、<br />
            特定の政策や候補者を支持するものではありません。
          </p>
          <p>
            意見の前に、<br />
            まず構造を見る。
          </p>
          <p>それが、このプロジェクトの立場です。</p>
        </div>
      </section>

      {/* データについて */}
      <section className="mb-14">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">データについて</p>
        <p className="text-textMain/70 leading-relaxed">
          本サイトは、新得町が公開している資料・議会記録・動画アーカイブをもとに構成しています。<br />
          内容に誤りがあれば修正します。
        </p>
      </section>

      {/* 実験について */}
      <section className="mb-16">
        <p className="text-sm tracking-widest text-textSub/60 mb-6">実験について</p>
        <p className="text-textMain/70 leading-relaxed">
          SHINTOKU ATLAS は進行中のプロジェクトです。<br />
          より良い可視化の方法を模索しています。
        </p>
      </section>

    </div>
  )
}
