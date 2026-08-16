// OGP画像用フォントの取得元とローカルキャッシュの場所。
//
// satori はシステムフォントを持たないので、和文フォントを渡さないと豆腐になる。
// Google Fonts の原本（OFL）を使うが、`next build` は複数ワーカーで並列に画像を作るため、
// 各ワーカーが 5MB のフォントを同時に取りにいくと取得が壊れる（fontkit が "Bad flags" で落ちる）。
// そこで `npm run og:fonts` がビルド前に1回だけ取得し、各ワーカーはキャッシュを読むだけにする。

import fs from "fs"
import path from "path"

export interface OgFontSource {
  /** ImageResponse に渡すフォント名 */
  name: string
  /** キャッシュのファイル名 */
  file: string
  url:  string
}

export const OG_FONT_SOURCES: OgFontSource[] = [
  {
    name: "Zen Old Mincho",
    file: "ZenOldMincho-Bold.ttf",
    url:  "https://raw.githubusercontent.com/google/fonts/main/ofl/zenoldmincho/ZenOldMincho-Bold.ttf",
  },
  {
    name: "Space Mono",
    file: "SpaceMono-Bold.ttf",
    url:  "https://raw.githubusercontent.com/google/fonts/main/ofl/spacemono/SpaceMono-Bold.ttf",
  },
]

/** リポジトリには入れない（.gitignore）。ビルドのたびに作り直してよい。 */
export const OG_FONT_CACHE_DIR = path.join(process.cwd(), ".cache", "og-fonts")

/** 途中で切れたダウンロードを掴まないための下限。実ファイルは 98KB 〜 5.4MB。 */
const MIN_FONT_BYTES = 50_000

export function cachedFontPath(font: OgFontSource): string {
  return path.join(OG_FONT_CACHE_DIR, font.file)
}

/** キャッシュが存在し、サイズが妥当なら true。 */
export function isCached(font: OgFontSource): boolean {
  const filePath = cachedFontPath(font)
  return fs.existsSync(filePath) && fs.statSync(filePath).size >= MIN_FONT_BYTES
}

/** 未キャッシュのフォントを取得する。失敗は投げる（呼び出し側が握りつぶすか決める）。 */
export async function downloadFont(font: OgFontSource): Promise<void> {
  const res = await fetch(font.url)
  if (!res.ok) throw new Error(`${font.name}: HTTP ${res.status}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.byteLength < MIN_FONT_BYTES) {
    throw new Error(`${font.name}: ${buffer.byteLength} バイトしか取得できませんでした`)
  }

  fs.mkdirSync(OG_FONT_CACHE_DIR, { recursive: true })
  // 書き込み途中のファイルを他のプロセスに読ませないよう、一時名で書いてから差し替える
  const tmpPath = `${cachedFontPath(font)}.${process.pid}.tmp`
  fs.writeFileSync(tmpPath, buffer)
  fs.renameSync(tmpPath, cachedFontPath(font))
}
