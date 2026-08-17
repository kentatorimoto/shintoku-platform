import fs from "fs"
import path from "path"
import { ImageResponse } from "next/og"
import { OG_CONTENT_TYPE, OG_SIZE, OgPlate, ogFonts, truncate } from "@/lib/og"
import type { CardsData, GikaiSession } from "@/scripts/lib/schema"

export const alt = "新得町議会の会期の記録 — Shintoku Atlas"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

function readJson<T>(...segments: string[]): T | null {
  try {
    const filePath = path.join(process.cwd(), "public", "data", ...segments)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
  } catch {
    return null
  }
}

export function generateStaticParams() {
  const sessions = readJson<GikaiSession[]>("gikai_sessions.json") ?? []
  return sessions.map(s => ({ id: s.id }))
}

const formatDate = (iso: string) => iso.replace(/-/g, ".")

export default async function OpengraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessions = readJson<GikaiSession[]>("gikai_sessions.json") ?? []
  const session = sessions.find(s => s.id === id)

  // 1枚目（headline）が会期のいちばん大きな出来事。無いセッションは見出しと日付だけで組む
  const headline = readJson<CardsData>("cards", `${id}.json`)?.cards.find(c => c.kind === "headline")

  return new ImageResponse(
    (
      <OgPlate
        eyebrow={session?.officialTitle ?? "新得町議会"}
        stamp={session ? formatDate(session.date) : undefined}
        title={session?.narrativeTitle ?? session?.officialTitle ?? "会議の記録"}
        lede={headline ? truncate(headline.title, 34) : undefined}
        footnote="町のことが、どう決まっているか。"
      />
    ),
    { ...size, fonts: await ogFonts() },
  )
}
