// OGP画像用の和文フォントを .cache/og-fonts/ に取得する（ビルド前に1回だけ）。
//
//   npx tsx scripts/fetch-og-fonts.ts
//
// 取得できなくてもビルドは止めない。同梱の Space Mono（assets/fonts/）が残るので、
// 見出しが明朝でなく既定のゴシックになるだけで、画像自体は生成できる。exit code は常に 0。

import path from "path"
import { OG_FONT_SOURCES, downloadFont, isAvailable } from "../lib/og-fonts"

async function main() {
  for (const font of OG_FONT_SOURCES) {
    if (isAvailable(font)) {
      console.log(`   ${font.name}: ${font.url ? "キャッシュ済み" : "同梱"}`)
      continue
    }
    try {
      await downloadFont(font)
      console.log(`   ${font.name}: 取得しました`)
    } catch (err) {
      console.warn(`⚠️  ${font.name} を取得できませんでした: ${err}`)
      console.warn("   OGPの見出しが明朝でなく既定のゴシックになります（画像は生成されます）。")
    }
  }
  console.log("✅ og:fonts")
}

if (path.basename(process.argv[1] ?? "") === "fetch-og-fonts.ts") {
  main().catch((err) => {
    // ここに来てもビルドは続ける
    console.warn(`⚠️  og:fonts: ${err instanceof Error ? err.message : err}`)
  })
}
