"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

const NAV_LINKS = [
  { href: "/announcements", label: "町政ニュース" },
  { href: "/newsletters", label: "広報誌検索" },
  { href: "/gikai", label: "議会" },
  { href: "/sources", label: "Sources" },
] as const

const GITHUB_URL = "https://github.com/kentatorimoto/shintoku-platform"

export default function Header() {
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

  // メニュー展開中はスクロール抑止（元の値を保存して復元）
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      <nav className="sticky top-0 z-50 bg-base/80 backdrop-blur border-b border-line/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-textMain font-semibold tracking-tight"
            onClick={close}
          >
            Shintoku Atlas
          </Link>

          {/* PC ナビ */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-textSub hover:text-textMain transition"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-textSub hover:text-textMain transition"
            >
              GitHub
            </a>
          </div>

          {/* モバイル ハンバーガー */}
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

      {/* モバイル メニュー */}
      {open && (
        <>
          {/* オーバーレイ */}
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={close}
            onTouchStart={close}
            aria-hidden="true"
          />

          {/* ドロワー */}
          <div className="fixed top-16 right-4 left-4 z-50 bg-ink border border-line rounded-xl p-4">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className="text-textSub hover:text-textMain hover:bg-base/50 transition rounded-lg px-4 py-3 text-base"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="text-textSub hover:text-textMain hover:bg-base/50 transition rounded-lg px-4 py-3 text-base"
              >
                GitHub
              </a>
            </div>
          </div>
        </>
      )}
    </>
  )
}
