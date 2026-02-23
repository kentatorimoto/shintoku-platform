import Link from "next/link"

const GITHUB_URL = "https://github.com/kentatorimoto/shintoku-platform"

const COL1 = [
  { href: "/gikai/sessions", label: "議会を読む",          external: false },
  { href: "/gikai",          label: "町の決定を読む",       external: false },
  { href: "/process",        label: "意思決定の流れを読む", external: false },
  { href: "/map",            label: "地形を読む",           external: false },
] as const

const COL2 = [
  { href: "/about",   label: "About",   external: false },
  { href: "/sources", label: "Sources", external: false },
  { href: GITHUB_URL, label: "GitHub",  external: true  },
] as const

function FooterLink({ href, label, external }: { href: string; label: string; external: boolean }) {
  const cls = "text-sm text-textMain hover:text-accent transition-colors"
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{label}</a>
  ) : (
    <Link href={href} className={cls}>{label}</Link>
  )
}

export default function Footer() {
  return (
    <footer className="mt-16 md:mt-20 border-t border-line/30 bg-ink">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-10">
          {/* ブランド */}
          <div>
            <p className="text-textMain font-semibold mb-2">Shintoku Atlas</p>
            <p className="text-xs text-textSub/60 leading-relaxed">
              新得町の公開情報を<br />整理・可視化するプロジェクト
            </p>
          </div>

          {/* リンク 2列 */}
          <div className="flex gap-12">
            <ul className="space-y-3">
              {COL1.map((l) => (
                <li key={l.href}><FooterLink {...l} /></li>
              ))}
            </ul>
            <ul className="space-y-3">
              {COL2.map((l) => (
                <li key={l.href}><FooterLink {...l} /></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 mt-8 border-t border-line/20 text-xs text-textSub/50">
          © 2026 Shintoku Atlas — 非公式・個人プロジェクト
        </div>
      </div>
    </footer>
  )
}
