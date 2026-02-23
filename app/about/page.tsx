import type { Metadata } from "next"
import Link from "next/link"

const GITHUB_URL = "https://github.com/kentatorimoto/shintoku-platform"

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

      <section className="pt-8 border-t border-line/20 flex gap-6">
        <Link
          href="/sources"
          className="text-sm text-textSub/50 hover:text-textMain transition-colors"
        >
          Sources
        </Link>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-textSub/50 hover:text-textMain transition-colors"
        >
          GitHub
        </a>
      </section>

    </div>
  )
}
