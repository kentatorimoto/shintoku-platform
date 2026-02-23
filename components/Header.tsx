"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

const NAV_LINKS = [
  { href: "/gikai/sessions", label: "議会を読む" },
  { href: "/gikai",          label: "町の決定を読む" },
  { href: "/process",        label: "意思決定の流れを読む" },
  { href: "/map",            label: "地形を読む" },
  "separator",
  { href: "/about",          label: "About" },
] as const

type NavItem = (typeof NAV_LINKS)[number]
type NavLink = Exclude<NavItem, string>
const isLink = (item: NavItem): item is NavLink => typeof item !== "string"

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

  /** パスが active かどうか（prefix 一致は境界文字で区切る） */
  function isActivePath(href: string) {
    if (pathname === href) return true
    if (href === "/") return false
    return pathname.startsWith(href + "/")
  }

  /** Desktop リンクのクラス */
  function desktopClass(href: string) {
    if (isActivePath(href)) return "text-textMain font-medium border-b border-accent pb-0.5 transition"
    return "text-textSub hover:text-textMain transition"
  }

  /** Mobile リンクのクラス */
  function mobileClass(href: string, external: boolean) {
    const base = "rounded-lg px-4 py-2.5 text-base font-medium block transition-colors"
    if (external) return `${base} text-textMain/70 hover:text-accent`
    return isActivePath(href)
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
              fontFamily: "var(--font-ibm-plex), 'IBM Plex Sans', sans-serif",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              backgroundImage: "linear-gradient(color-mix(in srgb, currentColor 60%, transparent), color-mix(in srgb, currentColor 60%, transparent))",
              backgroundSize: "80% 1px",
              backgroundPosition: "center bottom",
              backgroundRepeat: "no-repeat",
              paddingBottom: "3px",
              color: "#D5D3CC",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            SHINTOKU ATLAS
          </Link>

          {/* Desktop ナビ */}
          <div className="hidden md:flex items-center gap-5 text-sm">
            {NAV_LINKS.filter(isLink).map((link) => (
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
            {NAV_LINKS.map((item, i) =>
              isLink(item) ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className={mobileClass(item.href, false)}
                >
                  {item.label}
                </Link>
              ) : (
                <hr key={`sep-${i}`} className="my-2 border-line/40" />
              )
            )}
          </div>
        </>
      )}
    </>
  )
}
