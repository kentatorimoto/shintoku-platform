// 新得町議会チャンネルの新着動画を検知して GitHub Issue を立てる。
//
//   npx tsx scripts/watch-council.ts [--dry-run]
//   npx tsx scripts/watch-council.ts --video <url|videoId>   # 既知でもIssueを立て直す
//
// 責務は「見逃し防止」だけ。字幕の有無は見ない（auto-ingest.ts 実行時に判定する）。
// Issue を立てたあとの取り込みは auto-ingest.yml が続けて走らせる（同ワークフローの ingest ジョブ）。

import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"
import { COUNCIL_CHANNEL_ID, EXIT, TRANSCRIPT_RETRY_DAYS } from "./config"
import { extractVideoId } from "./fetch-transcript"

const ROOT = process.cwd()
// daily-sync.yml のグロブ（public/data/*.json）の対象外に置く
const KNOWN_PATH = path.join(ROOT, "data", "watch", "known-videos.json")

const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${COUNCIL_CHANNEL_ID}`

/**
 * Actions ランナーからの素の fetch は YouTube に HTTP 404 で弾かれる（ローカルからは 200 が返る）。
 * ブラウザ相当の User-Agent と Accept を名乗る。
 */
const FEED_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "application/atom+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.5",
  "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
}

/** リトライの待ち時間。弾かれ方が一時的なら、この 130 秒のあいだに復帰する。 */
const RETRY_DELAYS_MS = [10_000, 30_000, 90_000]

/** フィードと同じ 15 件を見れば足りる（1日1回の実行で取りこぼさない）。 */
const MAX_RESULTS = 15

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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

async function fetchFeedOnce(): Promise<Video[]> {
  const res = await fetch(FEED_URL, { headers: FEED_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const videos = parseFeed(await res.text())
  if (videos.length === 0) {
    throw new Error("動画を1件も取り出せませんでした（フィードの構造が変わった可能性があります）")
  }
  return videos
}

/** 取れなければ null を返す（呼び出し側がフォールバックを決める）。 */
async function fetchFeedWithRetry(): Promise<Video[] | null> {
  const attempts = RETRY_DELAYS_MS.length + 1

  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchFeedOnce()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`⚠️  RSSの取得に失敗（${i + 1}/${attempts}回目）: ${message}`)

      const delay = RETRY_DELAYS_MS[i]
      if (delay === undefined) break
      console.warn(`   ${delay / 1000}秒待って再試行します。`)
      await sleep(delay)
    }
  }
  return null
}

// ── YouTube Data API v3（RSSが全滅したときのフォールバック）──────────────────

interface ApiChannelsResponse {
  items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[]
}

interface ApiPlaylistItemsResponse {
  items?: {
    snippet?: { title?: string; resourceId?: { videoId?: string } }
    contentDetails?: { videoId?: string; videoPublishedAt?: string }
  }[]
}

async function callApi<T>(endpoint: string, params: Record<string, string>, apiKey: string): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`)
  for (const [key, value] of Object.entries({ ...params, key: apiKey })) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status} ${await res.text()}`)
  return await res.json() as T
}

/**
 * uploads プレイリスト経由で取る（search.list は 1 回 100 クォータ、こちらは 2 回で 2）。
 * APIキーが無ければ null。フォールバックを黙って諦めるのではなく、理由をログに残す。
 */
async function fetchFromApi(): Promise<Video[] | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.warn("⚠️  YOUTUBE_API_KEY が未設定のため、APIフォールバックはスキップします。")
    return null
  }

  try {
    console.log("   YouTube Data API v3 にフォールバックします。")
    const channel = await callApi<ApiChannelsResponse>(
      "channels", { part: "contentDetails", id: COUNCIL_CHANNEL_ID }, apiKey,
    )
    const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploads) throw new Error(`チャンネル ${COUNCIL_CHANNEL_ID} の uploads プレイリストが取れませんでした`)

    const playlist = await callApi<ApiPlaylistItemsResponse>(
      "playlistItems",
      { part: "snippet,contentDetails", playlistId: uploads, maxResults: String(MAX_RESULTS) },
      apiKey,
    )

    const videos: Video[] = []
    for (const item of playlist.items ?? []) {
      const id        = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId
      const title     = item.snippet?.title
      // プレイリストへの追加日時ではなく、動画自体の公開日時を使う
      const published = item.contentDetails?.videoPublishedAt
      if (!id || !title || !published) continue
      videos.push({ id, title, published, url: `https://www.youtube.com/watch?v=${id}` })
    }

    if (videos.length === 0) throw new Error("APIから動画を1件も取り出せませんでした")
    return videos
  } catch (err) {
    console.warn(`⚠️  APIフォールバックにも失敗: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

/** RSS → API の順に試し、どちらも駄目なら投げる（このときだけ exit 1）。 */
async function fetchVideos(): Promise<Video[]> {
  const fromFeed = await fetchFeedWithRetry()
  if (fromFeed) return fromFeed

  const fromApi = await fetchFromApi()
  if (fromApi) {
    console.log(`   APIから ${fromApi.length} 件取得しました。`)
    return fromApi
  }

  throw new Error(
    "RSSもAPIも取得できませんでした。\n" +
    "  YOUTUBE_API_KEY（リポジトリのSecret）が未設定なら、設定するとRSSが弾かれても取得できます。",
  )
}

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

## 取り込み

この Issue は **auto-ingest ワークフローが自動で取り込みます**（この直後と、以後は毎日12:00 JST）。
セッションIDとパートはタイトルから \`scripts/lib/session-id-rules.ts\` の対応表で推定します。

- 取り込めたら \`auto/session-{セッションID}\` ブランチのPRに載り、この Issue はマージ時に閉じます
- 字幕が未生成なら保留し、翌日以降に再試行します（${TRANSCRIPT_RETRY_DAYS}日で諦めてここに報告）
- 対応表に無いパターンなら、推定せずここにコメントして止まります

## 自動で止まったときの手動取り込み

\`\`\`bash
npm run add-session -- \\
  --id <セッションID> \\
  --url "${video.url}" \\
  --type <qna|honkaigi> \\
  --part <day1|part1> \\
  --label "<初日（6/3）など>" \\
  --date <YYYY-MM-DD> \\
  --title-official "<令和8年第2回新得町議会定例会>"
\`\`\`

セッションIDの規則と対応表は \`docs/auto-ingest.md\` を見てください。
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

const argValue = (flag: string) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const only = argValue("--video")

  const videos = await fetchVideos()

  // 取りこぼした動画の拾い直し。既知リストに入っていると通常の経路では二度とIssueが立たないので、
  // 明示的に指定されたときだけ既知判定を飛ばす（既知リストは触らない）。
  if (only) {
    const wanted = extractVideoId(only) ?? only
    const video = videos.find(v => v.id === wanted)
    if (!video) {
      throw new Error(
        `フィードの直近 ${MAX_RESULTS} 件に ${wanted} が見つかりません。\n` +
        `  古い動画は、Issueのタイトルを「[新着動画] <動画タイトル>」に合わせて手で立ててください。`,
      )
    }
    console.log(`\n📹 ${video.title}（${video.published}）`)
    createIssue(video, dryRun)
    return
  }

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
