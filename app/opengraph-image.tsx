import { ImageResponse } from "next/og"
import { OG_CONTENT_TYPE, OG_SIZE, OgPlate, ogFonts } from "@/lib/og"
import { LABELS } from "@/lib/labels"

export const alt = "Shintoku Atlas — 新得町議会記録集"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

/** セッション別の画像を持たないページ（トップ・About・索引など）が使う汎用OG。 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <OgPlate
        eyebrow={LABELS.siteFormalName}
        stamp="UNOFFICIAL"
        title={"町のことが、\nどう決まっているか。"}
        lede="新得町議会の記録を、構造のまま公開しています。"
        footnote="非公式・個人プロジェクト"
      />
    ),
    { ...size, fonts: await ogFonts() },
  )
}
