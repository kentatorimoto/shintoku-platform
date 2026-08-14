import Link from "next/link"
import { LABELS } from "@/lib/labels"

const GITHUB_URL = "https://github.com/kentatorimoto/shintoku-platform"

const COL1 = [
  { href: "/gikai/sessions", label: "議会を読む",          external: false },
  { href: "/gikai",          label: "町の決定を読む",       external: false },
  { href: "/process",        label: "意思決定の流れを読む", external: false },
] as const

const COL2 = [
  { href: "/about",   label: "About",   external: false },
  { href: "/sources", label: "Sources", external: false },
  { href: GITHUB_URL, label: "GitHub",  external: true  },
] as const

function FooterLink({ href, label, external }: { href: string; label: string; external: boolean }) {
  const cls = "text-sm text-textSub hover:text-accent transition-colors"
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{label}</a>
  ) : (
    <Link href={href} className={cls}>{label}</Link>
  )
}

export default function Footer() {
  return (
    <footer className="mt-20 border-t-[1.5px] border-textMain">
      <div className="max-w-[1040px] mx-auto px-6 py-7">
        {/* リンク 2列 */}
        <div className="flex gap-12 mb-7">
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

        {/* コピーライト ＋ 座標（モック準拠）*/}
        <div className="flex flex-wrap justify-between gap-4 pt-6 border-t border-line text-[12.5px] text-textSub">
          {/* ヘッダーから外した正式名称はここに残す（何のサイトかを最後に明示する）*/}
          <span>© 2026 SHINTOKU ATLAS（{LABELS.siteFormalName}）— 非公式・個人プロジェクト</span>
          <span className="mono text-[11px]">43°04′N 142°50′E</span>
        </div>
      </div>
    </footer>
  )
}
