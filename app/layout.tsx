import type { Metadata } from "next"
import Script from "next/script"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import BottomNav from "@/components/BottomNav"
import { Noto_Sans_JP, Zen_Old_Mincho, Space_Mono } from "next/font/google"
import "./globals.css"
import "leaflet/dist/leaflet.css"

// 本文
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto",
  display: "swap",
})

// 見出し・narrativeTitle のみ
const zenOldMincho = Zen_Old_Mincho({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-zen-mincho",
  display: "swap",
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
        {/* /process 配下は小豆の紙。直接ロード時に FOUC なしで data-paper を立てる。
            SPA 遷移は components/AzukiPaper.tsx が担う。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.dataset.paper=location.pathname.startsWith('/process')?'azuki':''`,
          }}
        />
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
      <body className="font-sans antialiased bg-base text-textMain min-h-screen flex flex-col">
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