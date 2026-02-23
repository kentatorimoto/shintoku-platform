import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About | Shintoku Atlas",
  description: "Shintoku Atlas は、新得の意思決定を可視化する観測装置です。",
}

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 mt-16">
          町を、構造として読む。
        </h1>
        <p className="text-textMain/70 text-lg leading-relaxed">
          SHINTOKU ATLAS は、新得の意思決定を可視化する観測装置です。
        </p>
      </div>
    </div>
  )
}
