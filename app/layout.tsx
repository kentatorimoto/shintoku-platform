import type { Metadata } from "next"
import Script from "next/script"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import BottomNav from "@/components/BottomNav"
import { Noto_Sans_JP, Zen_Old_Mincho, Space_Mono } from "next/font/google"
import "./globals.css"
import "leaflet/dist/leaflet.css"

// 本文
//
// preload: false は必須。和文フォントは unicode-range で細かく分割されるので、
// preload を有効にすると <link rel="preload" as="font"> が242本・woff2 が133本
// （2.06MB）同時に走り、コネクションを食い潰す。HTML も個々のファイルも1秒前後で
// 返るのに load イベントが20〜30秒かかっていた。
// display: "swap" があるので、先に代替書体で描いてから差し替わる。
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto",
  display: "swap",
  preload: false,
})

// 見出し・narrativeTitle のみ。本文よりさらに使用箇所が少ないので当然 preload しない
const zenOldMincho = Zen_Old_Mincho({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-zen-mincho",
  display: "swap",
  preload: false,
})

// 数値・日付・SHEET番号・座標
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Shintoku Atlas",
  description: "新得町議会の記録を、構造のまま公開しています",
  openGraph: {
    title: "Shintoku Atlas",
    description: "新得町議会の記録を、構造のまま公開しています",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${zenOldMincho.variable} ${spaceMono.variable}`}>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-PTNKSBK9Y7"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-PTNKSBK9Y7');
          `}
        </Script>
      </head>
      <body className="font-sans antialiased bg-paper text-textMain min-h-screen flex flex-col">
        <Header />
        <main className="pt-16 pb-16 md:pb-0 flex-1">
          {children}
        </main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  )
}