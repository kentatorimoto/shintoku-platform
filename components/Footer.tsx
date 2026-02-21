import Link from "next/link"

const GITHUB_URL = "https://github.com/kentatorimoto/shintoku-platform"

export default function Footer() {
  return (
    <footer className="mt-16 md:mt-20 border-t border-line/30 bg-ink">
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <h3 className="text-textMain font-semibold">Shintoku Atlas</h3>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-textSub/90">
            <Link href="/gikai" className="hover:text-accent transition">議会</Link>
            <Link href="/sources" className="hover:text-accent transition">Sources</Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="pt-6 mt-6 border-t border-line/20 text-xs text-textSub/60 text-left">
          © {new Date().getFullYear()} Shintoku Atlas
        </div>
      </div>
    </footer>
  )
}