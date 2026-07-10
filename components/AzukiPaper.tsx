"use client"

import { useEffect } from "react"

/**
 * /process 配下にいる間だけ <html data-paper="azuki"> を立て、離脱時に戻す。
 * ヘッダー・フッター・本文がすべて html の子孫なので、これ一つで全面が小豆に反転する。
 * 直接ロード時の初期値は app/layout.tsx の head インラインスクリプトが FOUC なしで設定し、
 * このコンポーネントは SPA 遷移（Link クリック）での切替を担う。
 * ページ遷移アニメーションは入れない（紙が即座に変わることが仕様）。
 */
export default function AzukiPaper() {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.paper = "azuki"
    return () => { root.dataset.paper = "" }
  }, [])
  return null
}
