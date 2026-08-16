// OGP画像用の和文フォントを .cache/og-fonts/ に取得する（ビルド前に1回だけ）。
//
//   npx tsx scripts/fetch-og-fonts.ts
//
// 取得できなくてもビルドは止めない（OGP画像が英数字だけになる）。ネットワークの無い環境で
// サイトのビルド自体が落ちる方が困るため。exit code は常に 0。

import path from "path"
import { OG_FONT_SOURCES, downloadFont, isCached } from "../lib/og-fonts"

async function main() {
  for (const font of OG_FONT_SOURCES) {
    if (isCached(font)) {
      console.log(`   ${font.name}: キャッシュ済み`)
      continue
    }
    try {
      await downloadFont(font)
      console.log(`   ${font.name}: 取得しました`)
    } catch (err) {
      console.warn(`⚠️  ${font.name} を取得できませんでした（OGPは英数字のみになります）: ${err}`)
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
