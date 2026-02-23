import Link from "next/link"

const GITHUB_URL = "https://github.com/kentatorimoto/shintoku-platform"

const SECTIONS = [
  {
    title: "見る",
    links: [
      { href: "/gikai/sessions", label: "町議会を読む", external: false },
      { href: "/gikai",          label: "議決結果",     external: false },
      { href: "/map",            label: "地形マップ",   external: false },
    ],
  },
  {
    title: "理解する",
    links: [
      { href: "/insights", label: "分析",             external: false },
      { href: "/process",  label: "意思決定プロセス",   external: false },
    ],
  },
  {
    title: "プロジェクト",
    links: [
      { href: "/about",   label: "About",   external: false },
      { href: "/sources", label: "Sources", external: false },
      { href: GITHUB_URL, label: "GitHub",  external: true  },
    ],
  },
] as const

export default function Footer() {
  return (
    <footer className="mt-16 md:mt-20 border-t border-line/30 bg-ink">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 sm:gap-8">
          {/* ブランド */}
          <div className="sm:col-span-1">
            <p className="text-textMain font-semibold mb-2">Shintoku Atlas</p>
            <p className="text-xs text-textSub/60 leading-relaxed">
              新得町の公開情報を<br />整理・可視化するプロジェクト
            </p>
          </div>

          {/* リンクセクション */}
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-[10px] font-semibold tracking-widest text-textSub/50 uppercase mb-4">
                {section.title}
              </p>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-textMain hover:text-accent transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm font-medium text-textMain hover:text-accent transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 mt-8 border-t border-line/20 text-xs text-textSub/50">
          © {new Date().getFullYear()} Shintoku Atlas — 非公式・個人プロジェクト
        </div>
      </div>
    </footer>
  )
}
