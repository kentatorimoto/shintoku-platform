import type { Metadata } from "next"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Inter, Noto_Sans_JP, IBM_Plex_Sans } from "next/font/google"
import "./globals.css"
import "leaflet/dist/leaflet.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto",
  display: "swap",
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-ibm-plex",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Shintoku Atlas",
  description: "An unofficial public information dashboard.",
  openGraph: {
    title: "Shintoku Atlas",
    description: "An unofficial public information dashboard.",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable} ${ibmPlexSans.variable}`}>
      <body className="font-sans antialiased bg-base text-textMain min-h-screen flex flex-col">
        <Header />
        <main className="pt-16 flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}