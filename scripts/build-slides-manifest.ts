// public/slides/** を走査して、スライド画像の一覧を public/data/slides.json に書き出す。
//
//   npx tsx scripts/build-slides-manifest.ts
//
// なぜ必要か:
//   セッション詳細ページが fs.readdirSync(public/slides/{id}/{dir}) でスライドを
//   数えていたため、Next のファイルトレースが **public/slides 配下の全JPEG**（172MB）を
//   このルートの依存として取り込んでいた。ビルド時に一覧を作って静的にimportすれば、
//   実行時のファイル走査もトレースへの巻き込みも無くなる。

import fs from "fs"
import path from "path"

const ROOT       = process.cwd()
const SLIDES_DIR = path.join(ROOT, "public", "slides")
const OUT_PATH   = path.join(ROOT, "public", "data", "slides.json")

/** セッションID → slidesDir → 画像の公開パス（page-001.jpg 順） */
export type SlidesManifest = Record<string, Record<string, string[]>>

function build(): SlidesManifest {
  const manifest: SlidesManifest = {}
  if (!fs.existsSync(SLIDES_DIR)) return manifest

  for (const sessionId of fs.readdirSync(SLIDES_DIR).sort()) {
    const sessionDir = path.join(SLIDES_DIR, sessionId)
    if (!fs.statSync(sessionDir).isDirectory()) continue

    for (const slidesDir of fs.readdirSync(sessionDir).sort()) {
      const dir = path.join(sessionDir, slidesDir)
      if (!fs.statSync(dir).isDirectory()) continue

      const images = fs.readdirSync(dir)
        .filter(f => /^page-\d+\.jpg$/.test(f))
        .sort()
        .map(f => `/slides/${sessionId}/${slidesDir}/${f}`)

      if (images.length === 0) continue
      manifest[sessionId] ??= {}
      manifest[sessionId][slidesDir] = images
    }
  }
  return manifest
}

function main() {
  const manifest = build()
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2) + "\n")

  const sessions = Object.keys(manifest).length
  const images = Object.values(manifest).flatMap(d => Object.values(d)).reduce((n, a) => n + a.length, 0)
  console.log(`✅ build:slides-manifest: ${sessions} sessions, ${images} images → ${path.relative(ROOT, OUT_PATH)}`)
}

if (path.basename(process.argv[1] ?? "") === "build-slides-manifest.ts") main()
