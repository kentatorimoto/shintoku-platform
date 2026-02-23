"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

// Desktop 一次導線
const PRIMARY_LINKS = [
  { href: "/gikai/sessions", label: "町議会を読む" },
  { href: "/gikai",          label: "議決結果" },
  { href: "/insights",       label: "分析" },
] as const

// Desktop 二次導線（| 区切り後）
const SECONDARY_LINKS = [
  { href: "/map",   label: "地形マップ" },
  { href: "/about", label: "About" },
] as const

// Mobile ドロワー セクション構造
const MOBILE_SECTIONS = [
  {
    title: "読む",
    links: [
      { href: "/gikai/sessions", label: "町議会を読む", external: false },
      { href: "/gikai",          label: "議決結果",     external: false },
    ],
  },
  {
    title: "読み解く",
    links: [
      { href: "/insights", label: "分析",             external: false },
      { href: "/process",  label: "意思決定プロセス",   external: false },
    ],
  },
  {
    title: "情報",
    links: [
      { href: "/map",     label: "地形マップ", external: false },
      { href: "/sources", label: "Sources",   external: false },
      { href: "/about",   label: "About",     external: false },
      { href: GITHUB_URL, label: "GitHub",    external: true  },
    ],
  },
] as const

export default function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  // ESC で閉じる
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, close])

  // メニュー展開中はスクロール抑止
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  /** Desktop リンクのクラス */
  function desktopClass(href: string) {
    const isActive = pathname === href || (href !== "/" && pathname.startsWith(href))
    if (isActive) return "text-textMain font-medium border-b border-accent pb-0.5 transition"
    return "text-textSub hover:text-textMain transition"
  }

  /** Mobile リンクのクラス */
  function mobileClass(href: string, external: boolean) {
    const base = "rounded-lg px-4 py-2.5 text-base font-medium block transition-colors"
    if (external) return `${base} text-textMain/70 hover:text-accent`
    const isActive = pathname === href || (href !== "/" && pathname.startsWith(href))
    return isActive
      ? `${base} text-accent bg-accent/8`
      : `${base} text-textMain hover:text-accent`
  }

  return (
    <>
      <nav className="sticky top-0 z-50 bg-base/80 backdrop-blur border-b border-line/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* ロゴ */}
          <Link
            href="/"
            onClick={close}
            style={{
              fontFamily: "'Spectral', serif",
              fontWeight: 500,
              letterSpacing: "0.08em",
              borderBottom: "0.5px solid #E6E4DD",
              paddingBottom: "2px",
              color: "#E6E4DD",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            SHINTOKU ATLAS
          </Link>

          {/* Desktop ナビ */}
          <div className="hidden md:flex items-center gap-5 text-sm">
            {PRIMARY_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={desktopClass(link.href)}>
                {link.label}
              </Link>
            ))}

            <span className="text-line select-none" aria-hidden="true">|</span>

            {SECONDARY_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={desktopClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile ハンバーガー */}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="md:hidden text-textSub hover:text-textMain transition p-2 -mr-2"
            aria-label={open ? "メニューを閉じる" : "メニューを開く"}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile ドロワー */}
      {open && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-40 bg-base/80 backdrop-blur"
            onClick={close}
            onTouchStart={close}
            aria-hidden="true"
          />

          {/* パネル */}
          <div className="fixed top-20 right-4 left-4 z-50 bg-ink border border-line rounded-2xl p-5">
            {MOBILE_SECTIONS.map((section, i) => (
              <div key={section.title}>
                {/* セクション区切り（初回以外） */}
                {i > 0 && (
                  <div className="h-px bg-line/40 my-4" />
                )}

                {/* カテゴリ見出し：小さく・薄く・大文字 */}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-textSub/50 px-4 mb-3">
                  {section.title}
                </p>

                {/* リンク */}
                {section.links.map((link) =>
                  link.external ? (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={close}
                      className={mobileClass(link.href, true)}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={close}
                      className={mobileClass(link.href, false)}
                    >
                      {link.label}
                    </Link>
                  )
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
