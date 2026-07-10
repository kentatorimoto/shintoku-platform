// 新得町議会チャンネルの新着動画を検知して GitHub Issue を立てる。
//
//   npx tsx scripts/watch-council.ts [--dry-run]
//
// 責務は「見逃し防止」だけ。字幕の有無は見ない（add-session.ts 実行時に判定する）。
// 抽出まで自動でやらないのは、セッションIDと種別（qna / honkaigi）の判断が人間の仕事だから。

import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"
import { COUNCIL_CHANNEL_ID, EXIT } from "./config"

const ROOT = process.cwd()
// daily-sync.yml のグロブ（public/data/*.json）の対象外に置く
const KNOWN_PATH = path.join(ROOT, "data", "watch", "known-videos.json")

const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${COUNCIL_CHANNEL_ID}`

export interface Video {
  id:        string
  title:     string
  published: string
  url:       string
}

// ── RSS ─────────────────────────────────────────────────────────────────────

/** YouTube のフィードは固定構造なので、依存を増やさず正規表現で読む。 */
export function parseFeed(xml: string): Video[] {
  const videos: Video[] = []
  for (const entry of xml.split("<entry>").slice(1)) {
    const id        = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(entry)?.[1]
    const title     = /<title>([^<]*)<\/title>/.exec(entry)?.[1]
    const published = /<published>([^<]+)<\/published>/.exec(entry)?.[1]
    if (!id || !title || !published) continue
    videos.push({ id, title: decodeXml(title), published, url: `https://www.youtube.com/watch?v=${id}` })
  }
  return videos
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'").replace(/&amp;/g, "&")

// ── 既知動画リスト ──────────────────────────────────────────────────────────

function loadKnown(): Set<string> {
  if (!fs.existsSync(KNOWN_PATH)) return new Set()
  const data = JSON.parse(fs.readFileSync(KNOWN_PATH, "utf-8")) as { videoIds: string[] }
  return new Set(data.videoIds)
}

function saveKnown(ids: Set<string>) {
  fs.mkdirSync(path.dirname(KNOWN_PATH), { recursive: true })
  fs.writeFileSync(KNOWN_PATH, JSON.stringify({ videoIds: [...ids].sort() }, null, 2) + "\n")
}

// ── Issue ───────────────────────────────────────────────────────────────────

function issueBody(video: Video): string {
  return `新得町議会チャンネルに新しい動画が公開されました。

| 項目 | 値 |
|---|---|
| タイトル | ${video.title} |
| 公開日 | ${video.published} |
| URL | ${video.url} |

## 取り込み手順

セッションIDと種別（\`qna\` / \`honkaigi\`）を決めて、次のコマンドを実行してください。

\`\`\`bash
npm run add-session -- \\
  --id <セッションID> \\
  --url "${video.url}" \\
  --type <qna|honkaigi> \\
  --part <day1|part1|session> \\
  --label "<初日（6/3）など>" \\
  --date <YYYY-MM-DD> \\
  --title-official "<令和8年定例第2回新得町議会>"
\`\`\`

セッションIDの規則: \`r{元号年}-{西暦年}-{月}-{種別}\`（例: \`r8-2026-06-regular-2\`）

## 字幕がまだ生成されていない場合

\`add-session\` が exit 2 で止まったら、公開直後で自動字幕が未生成です。数時間おいて再実行してください。
`
}

function createIssue(video: Video, dryRun: boolean) {
  const title = `[新着動画] ${video.title}`
  if (dryRun) {
    console.log(`   (dry-run) Issue を作成: ${title}`)
    return
  }
  execFileSync("gh", ["issue", "create", "--title", title, "--body", issueBody(video)], {
    cwd: ROOT,
    stdio: "inherit",
  })
}

// ── メイン ──────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run")

  const res = await fetch(FEED_URL)
  if (!res.ok) throw new Error(`RSSの取得に失敗しました（HTTP ${res.status}）: ${FEED_URL}`)
  const videos = parseFeed(await res.text())
  if (videos.length === 0) throw new Error("RSSから動画を1件も取り出せませんでした。フィードの構造が変わった可能性があります。")

  const known = loadKnown()
  const isFirstRun = known.size === 0
  const fresh = videos.filter(v => !known.has(v.id))

  console.log(`フィード ${videos.length} 件 / 既知 ${known.size} 件 / 新着 ${fresh.length} 件`)

  if (isFirstRun) {
    // 初回はフィード全件をIssueにしても意味がないので、既知リストの初期化だけ行う。
    console.log("初回実行のため、Issueは作らず既知リストを初期化します。")
  } else {
    for (const video of fresh) {
      console.log(`\n📹 ${video.title}（${video.published}）`)
      createIssue(video, dryRun)
    }
  }

  if (!dryRun) {
    saveKnown(new Set([...known, ...videos.map(v => v.id)]))
    console.log(`\n✅ ${path.relative(ROOT, KNOWN_PATH)} を更新（既知 ${known.size + fresh.length} 件）`)
  }
}

if (path.basename(process.argv[1] ?? "") === "watch-council.ts") {
  main().catch((err) => {
    console.error(`❌ watch-council failed: ${err instanceof Error ? err.message : err}`)
    process.exit(EXIT.ERROR)
  })
}
