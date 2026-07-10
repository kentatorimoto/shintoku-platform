"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Search } from "lucide-react"
import GlobalSearch from "@/components/GlobalSearch"

const NAV_LINKS = [
  { href: "/",               label: "トップ" },
  { href: "/gikai/sessions", label: "議会を読む" },
  { href: "/gikai",          label: "決まったこと" },
  { href: "/process",        label: "流れを読む" },
  { href: "/sources",        label: "ソース" },
  { href: "/about",          label: "About" },
] as const

/** デスクトップナビに表示するリンク（トップは除外） */
const DESKTOP_NAV_LINKS = NAV_LINKS.filter((l) => l.href !== "/" && l.href !== "/sources")

export default function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

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

  /** リンクがアクティブか判定（より具体的なリンクを優先） */
  function isActive(href: string) {
    if (pathname === href) return true
    if (href === "/") return false
    if (!pathname.startsWith(href + "/")) return false
    // より具体的にマッチする他のリンクがあれば非アクティブ
    return !NAV_LINKS.some(
      (other) =>
        other.href !== href &&
        other.href.length > href.length &&
        other.href.startsWith(href) &&
        (pathname === other.href || pathname.startsWith(other.href + "/"))
    )
  }

  /** Desktop リンクのクラス。ホバー/カレントは accent の 2px 下線 */
  function desktopClass(href: string) {
    const base = "text-textMain pb-0.5 border-b-2 transition-colors"
    return isActive(href)
      ? `${base} border-accent`
      : `${base} border-transparent hover:border-accent`
  }

  /** Mobile リンクのクラス */
  function mobileClass(href: string) {
    const base = "rounded-[3px] px-4 py-2.5 text-base font-medium block transition-colors"
    return isActive(href)
      ? `${base} text-accent bg-hover`
      : `${base} text-textMain hover:text-accent`
  }

  return (
    <>
      <nav className="sticky top-0 z-50 bg-base/80 backdrop-blur border-b border-line/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* ワードマーク：Space Mono ＋ 和文サブ */}
          <Link href="/" onClick={close} className="flex items-baseline gap-2.5 text-textMain">
            <span
              className="mono font-bold text-[15px] uppercase"
              style={{ letterSpacing: "0.14em" }}
            >
              SHINTOKU ATLAS
            </span>
            <span
              className="text-textSub text-[11px] font-normal hidden sm:inline"
              style={{ letterSpacing: "0.08em" }}
            >
              新得町議会記録集
            </span>
          </Link>

          {/* Desktop ナビ */}
          <div className="hidden md:flex items-center gap-5 text-sm">
            {DESKTOP_NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={desktopClass(link.href)}>
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="text-textSub hover:text-textMain transition p-1.5"
              aria-label="検索"
            >
              <Search size={18} />
            </button>
          </div>

          {/* Mobile: 検索 + ハンバーガー */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="text-textSub hover:text-textMain transition p-2"
              aria-label="検索"
            >
              <Search size={22} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="text-textSub hover:text-textMain transition p-2 -mr-2"
              aria-label={open ? "メニューを閉じる" : "メニューを開く"}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
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
          <div className="fixed top-20 right-4 left-4 z-50 bg-ink border border-line rounded-[3px] p-5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className={mobileClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}

      {/* グローバル検索モーダル */}
      <GlobalSearch open={searchOpen} onClose={closeSearch} />
    </>
  )
}
