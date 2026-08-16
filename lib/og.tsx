// OGP画像の共通部品。next/og（satori）でビルド時に静的生成する。
//
// 版面は docs/design の図版様式に合わせる ——「亜麻」の紙、図郭フレーム（四隅ティック）、
// narrativeTitle は明朝、数値・日付は Space Mono、差し色の茜はドット1つだけ。

import fs from "fs"
import type { ReactElement } from "react"
import { OG_FONT_SOURCES, downloadFont, fontPath, isAvailable } from "@/lib/og-fonts"

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = "image/png"

/** app/globals.css の @theme（亜麻）と同じ値。片方だけ変えないこと。 */
export const OG_COLORS = {
  base:       "#e7e8dc",
  line:       "#d0d2c2",
  accent:     "#b8432c",
  textMain:   "#23241c",
  textSub:    "#67685a",
} as const

// ── フォント ────────────────────────────────────────────────────────────────

interface OgFont {
  name:   string
  data:   Buffer
  weight: 700
  style:  "normal"
}

let fontCache: Promise<OgFont[]> | null = null

/**
 * 同梱フォント（assets/fonts/）と、取得済みの和文フォント（.cache/og-fonts/）を読む。
 * dev サーバーなど `npm run og:fonts` を経ていない場合はその場で取りにいく。
 *
 * 明朝が用意できなくても、同梱の Space Mono が1つあれば版面は成立する（和文は既定のゴシックになる）。
 * **フォントが1つも無いと satori は "No fonts are loaded" で落ちる**ので、同梱フォントは消さないこと。
 */
export function ogFonts(): Promise<OgFont[]> {
  fontCache ??= (async () => {
    const fonts: OgFont[] = []
    for (const font of OG_FONT_SOURCES) {
      try {
        if (!isAvailable(font)) await downloadFont(font)
        fonts.push({
          name:   font.name,
          data:   fs.readFileSync(fontPath(font)),
          weight: 700,
          style:  "normal",
        })
      } catch (err) {
        console.warn(`⚠️  OGPフォント ${font.name} を用意できませんでした: ${err}`)
      }
    }
    return fonts
  })()
  return fontCache
}

// ── 版面 ────────────────────────────────────────────────────────────────────

const MINCHO = "Zen Old Mincho"
const MONO   = "Space Mono"

/** 図郭フレームの四隅ティック（PlateFrame.tsx と同じ意匠）。 */
function Ticks(): ReactElement {
  const len = 30
  const w = 3
  const corners = [
    { top: -w, left: -w, borderTop: `${w}px solid ${OG_COLORS.textMain}`, borderLeft: `${w}px solid ${OG_COLORS.textMain}`, transform: "translate(-16px, -16px)" },
    { top: -w, right: -w, borderTop: `${w}px solid ${OG_COLORS.textMain}`, borderRight: `${w}px solid ${OG_COLORS.textMain}`, transform: "translate(16px, -16px)" },
    { bottom: -w, left: -w, borderBottom: `${w}px solid ${OG_COLORS.textMain}`, borderLeft: `${w}px solid ${OG_COLORS.textMain}`, transform: "translate(-16px, 16px)" },
    { bottom: -w, right: -w, borderBottom: `${w}px solid ${OG_COLORS.textMain}`, borderRight: `${w}px solid ${OG_COLORS.textMain}`, transform: "translate(16px, 16px)" },
  ]
  return (
    <>
      {corners.map((style, i) => (
        <div key={i} style={{ position: "absolute", width: len, height: len, ...style }} />
      ))}
    </>
  )
}

export interface OgPlateProps {
  /** 左上の小見出し（例: 会議名・サイト名） */
  eyebrow:  string
  /** 右上のモノスペース表記（日付・SHEET番号など） */
  stamp?:   string
  /** 主役。明朝で組む。改行（\n）はそのまま反映される */
  title:    string
  /** 主役の下に1行だけ添える補足 */
  lede?:    string
  /** 最下段の左（正式名称など） */
  footnote: string
}

/**
 * OGP版面。1200×630。
 * 文字数で級数を落とし、長い narrativeTitle でも枠から溢れないようにする。
 */
export function OgPlate({ eyebrow, stamp, title, lede, footnote }: OgPlateProps): ReactElement {
  const titleSize = title.length > 26 ? 50 : title.length > 16 ? 58 : 70

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: OG_COLORS.base,
        padding: 56,
        fontFamily: MINCHO,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          border: `3px solid ${OG_COLORS.textMain}`,
          padding: "44px 60px",
        }}
      >
        <Ticks />

        {/* 上段。letterSpacing の分だけ右端が伸びるので、右要素は縮めずに余白で逃がす */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, color: OG_COLORS.textSub }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: OG_COLORS.accent, marginRight: 14 }} />
            <div style={{ fontFamily: MONO, letterSpacing: "0.14em", color: OG_COLORS.textMain }}>SHINTOKU ATLAS</div>
          </div>
          {stamp && (
            <div style={{ display: "flex", flexShrink: 0, fontFamily: MONO, letterSpacing: "0.08em", paddingRight: 14 }}>
              {stamp}
            </div>
          )}
        </div>

        {/* 主役 */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginTop: 20, paddingBottom: 20 }}>
          <div style={{ fontSize: 24, color: OG_COLORS.textSub, marginBottom: 18 }}>{eyebrow}</div>
          <div style={{ fontSize: titleSize, lineHeight: 1.32, color: OG_COLORS.textMain, whiteSpace: "pre-wrap" }}>{title}</div>
          {lede && (
            <div style={{ display: "flex", fontSize: 25, lineHeight: 1.5, color: OG_COLORS.textSub, marginTop: 20 }}>
              {lede}
            </div>
          )}
        </div>

        {/* 下段 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `2px solid ${OG_COLORS.line}`,
            paddingTop: 20,
            fontSize: 20,
            color: OG_COLORS.textSub,
          }}
        >
          <div style={{ display: "flex" }}>{footnote}</div>
          <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: "0.08em" }}>43°04′N 142°50′E</div>
        </div>
      </div>
    </div>
  )
}

/** 1行に収めるための省略（satori は text-overflow を解釈しないので自前で切る）。 */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
