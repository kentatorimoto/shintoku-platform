// OGP画像用フォントの在り処。
//
// satori はシステムフォントを持たないので、フォントを渡さないと画像が作れない
// （1つも渡さないと "No fonts are loaded" でビルドごと落ちる）。そこで2段構えにする。
//
//   - Space Mono（98KB）は assets/fonts/ に同梱する。これが最後の砦。1つでも渡せていれば
//     next/og の既定フォントが和文を拾うので、明朝でなくなるだけで版面は成立する。
//   - Zen Old Mincho（5.4MB）は Google Fonts の原本をビルド前に1回だけ取得する。
//     サブセットを同梱しないのは、新しいセッションに未知の漢字が出ても欠けないようにするため。
//
// `next build` は複数ワーカーで並列に画像を作る。各ワーカーが 5.4MB を同時に取りにいくと
// 取得が壊れて fontkit が "Bad flags" で落ちるため、`npm run og:fonts` が先に取得しておく。

import fs from "fs"
import path from "path"

export interface OgFontSource {
  /** ImageResponse に渡すフォント名 */
  name: string
  file: string
  /** 取得元。省略時は assets/fonts/ に同梱されている */
  url?: string
}

export const OG_FONT_SOURCES: OgFontSource[] = [
  {
    name: "Zen Old Mincho",
    file: "ZenOldMincho-Bold.ttf",
    url:  "https://raw.githubusercontent.com/google/fonts/main/ofl/zenoldmincho/ZenOldMincho-Bold.ttf",
  },
  {
    // 同梱（OFL-1.1。ライセンス全文は assets/fonts/OFL.txt）
    name: "Space Mono",
    file: "SpaceMono-Bold.ttf",
  },
]

/** ダウンロードしたフォントの置き場。リポジトリには入れない（.gitignore）。 */
export const OG_FONT_CACHE_DIR = path.join(process.cwd(), ".cache", "og-fonts")

/** 同梱フォントの置き場。 */
export const OG_FONT_BUNDLED_DIR = path.join(process.cwd(), "assets", "fonts")

/** 途中で切れたダウンロードを掴まないための下限。実ファイルは 98KB 〜 5.4MB。 */
const MIN_FONT_BYTES = 50_000

export function fontPath(font: OgFontSource): string {
  return font.url
    ? path.join(OG_FONT_CACHE_DIR, font.file)
    : path.join(OG_FONT_BUNDLED_DIR, font.file)
}

/** そのまま読める状態にあるか（同梱フォントは常に true）。 */
export function isAvailable(font: OgFontSource): boolean {
  const filePath = fontPath(font)
  return fs.existsSync(filePath) && fs.statSync(filePath).size >= MIN_FONT_BYTES
}

/** 未取得のフォントを取りにいく。失敗は投げる（呼び出し側が握りつぶすか決める）。 */
export async function downloadFont(font: OgFontSource): Promise<void> {
  if (!font.url) throw new Error(`${font.name}: ${fontPath(font)} が見つかりません`)

  const res = await fetch(font.url)
  if (!res.ok) throw new Error(`${font.name}: HTTP ${res.status}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.byteLength < MIN_FONT_BYTES) {
    throw new Error(`${font.name}: ${buffer.byteLength} バイトしか取得できませんでした`)
  }

  fs.mkdirSync(OG_FONT_CACHE_DIR, { recursive: true })
  // 書き込み途中のファイルを他のプロセスに読ませないよう、一時名で書いてから差し替える
  const tmpPath = `${fontPath(font)}.${process.pid}.tmp`
  fs.writeFileSync(tmpPath, buffer)
  fs.renameSync(tmpPath, fontPath(font))
}
