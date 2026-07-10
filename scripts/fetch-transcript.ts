// YouTube字幕を取得して Layer 0（content/sessions/{id}/transcripts/）に保存する。
//
//   npx tsx scripts/fetch-transcript.ts --url <youtube-url> --out <path> [--force]
//
// exit code は scripts/config.ts の EXIT 規約に従う:
//   0 成功 / 1 エラー / 2 字幕未生成（再試行） / 3 字幕が恒久的に無効（スキップ）
//
// youtube-transcript のエラークラスは使わない。ライブラリは「字幕トラックが空」を
// 一律 YoutubeTranscriptDisabledError にするため、次の3つを区別できない:
//   (a) 投稿者が字幕を無効化した  (b) 自動字幕がまだ生成されていない  (c) 動画が非公開
// watchページを自前で検分して分類する。

import fs from "fs"
import path from "path"
import { YoutubeTranscript } from "youtube-transcript"
import { EXIT, TRANSCRIPT_PENDING_WINDOW_HOURS } from "./config"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// ── URL → 動画ID ────────────────────────────────────────────────────────────

/**
 * `youtube-transcript` の ID 抽出は `/live/` 形式を知らず `Impossible to retrieve
 * Youtube video ID.` で落ちる。議会はライブ配信のアーカイブを使うので自前で抽出する。
 */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed

  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/v\/([\w-]{11})/,
  ]
  for (const re of patterns) {
    const m = re.exec(trimmed)
    if (m) return m[1]
  }
  return null
}

// ── watchページの検分 ───────────────────────────────────────────────────────

interface VideoProbe {
  playable:        boolean
  playabilityStatus: string
  hasCaptions:     boolean
  publishedAt:     string | null
  title:           string | null
  captionLanguages: string[]
}

async function probeVideo(videoId: string): Promise<VideoProbe> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "ja" },
  })
  if (!res.ok) throw new Error(`watchページの取得に失敗しました（HTTP ${res.status}）`)
  const html = await res.text()

  if (html.includes('class="g-recaptcha"')) {
    throw new Error("YouTubeにレート制限されています（reCAPTCHA）。時間をおいて再試行してください。")
  }

  const status = /"playabilityStatus":\{"status":"([A-Z_]+)"/.exec(html)?.[1] ?? "UNKNOWN"
  // "captionTracks":[] は「トラックなし」。オブジェクトが1つ以上あるときだけ真とする。
  const hasCaptions = /"captionTracks":\[\{/.test(html)
  // `s` フラグは target: ES2017 では使えないので [\s\S] で代用する
  const languages = [...html.matchAll(/"captionTracks":\[[\s\S]*?\]/g)]
    .flatMap(m => [...m[0].matchAll(/"languageCode":"([\w-]+)"/g)].map(l => l[1]))

  return {
    playable:          status === "OK",
    playabilityStatus: status,
    hasCaptions,
    publishedAt:       /"publishDate":"([^"]+)"/.exec(html)?.[1] ?? null,
    title:             /"title":\{"simpleText":"([^"]+)"/.exec(html)?.[1] ?? null,
    captionLanguages:  [...new Set(languages)],
  }
}

/** 公開から TRANSCRIPT_PENDING_WINDOW_HOURS 以内なら「字幕はまだ生成中」とみなす。 */
export function isWithinPendingWindow(publishedAt: string | null): boolean {
  // 公開日時が読めないときは再試行側に倒す（恒久無効と決めつけて取りこぼすより安全）。
  if (!publishedAt) return true
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000
  return ageHours < TRANSCRIPT_PENDING_WINDOW_HOURS
}

// ── 字幕の整形 ──────────────────────────────────────────────────────────────

function formatTimestamp(offsetMs: number): string {
  const total = Math.floor(offsetMs / 1000)
  const h = String(Math.floor(total / 3600)).padStart(2, "0")
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
  const s = String(total % 60).padStart(2, "0")
  return `${h}:${m}:${s}`
}

/** 自動字幕にはHTMLエンティティが混じることがある。 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

export interface TranscriptResult {
  text:      string
  segments:  number
  chars:     number
  durationMinutes: number
}

async function fetchTranscript(videoId: string, url: string): Promise<TranscriptResult> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ja" })
  const last = segments[segments.length - 1]
  const durationMinutes = last ? (last.offset + last.duration) / 60_000 : 0

  // タイムスタンプは「出典に動画の該当時刻リンクを付ける」ための布石。抽出時にAIが参照できる。
  const body = segments
    .map(s => `[${formatTimestamp(s.offset)}] ${decodeEntities(s.text)}`)
    .join("\n")

  const header = [
    `# source: ${url}`,
    `# video_id: ${videoId}`,
    `# fetched: ${new Date().toISOString()}`,
    `# segments: ${segments.length}`,
    "",
  ].join("\n")

  return {
    text:  `${header}\n${body}\n`,
    segments: segments.length,
    chars: segments.reduce((a, s) => a + s.text.length, 0),
    durationMinutes,
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

interface Args {
  url:   string
  out:   string
  force: boolean
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const url = get("--url")
  const out = get("--out")
  if (!url || !out) {
    throw new Error("使い方: npx tsx scripts/fetch-transcript.ts --url <youtube-url> --out <path> [--force]")
  }
  return { url, out, force: argv.includes("--force") }
}

/** 取得〜保存。呼び出し側（add-session.ts）からも使えるよう exit せず結果を返す。 */
export async function fetchTranscriptToFile(
  url: string,
  outPath: string,
  force = false,
): Promise<{ code: number; message: string }> {
  const videoId = extractVideoId(url)
  if (!videoId) {
    return { code: EXIT.ERROR, message: `YouTubeのURLから動画IDを取り出せませんでした: ${url}` }
  }

  if (fs.existsSync(outPath) && !force) {
    return { code: EXIT.OK, message: `既に存在するのでスキップしました: ${path.relative(process.cwd(), outPath)}（上書きは --force）` }
  }

  const probe = await probeVideo(videoId)

  if (!probe.playable) {
    return {
      code: EXIT.ERROR,
      message:
        `動画を視聴できません（playabilityStatus: ${probe.playabilityStatus}）。\n` +
        `  非公開化・限定公開・削除された可能性があります: https://www.youtube.com/watch?v=${videoId}`,
    }
  }

  if (!probe.hasCaptions) {
    if (isWithinPendingWindow(probe.publishedAt)) {
      return {
        code: EXIT.TRANSCRIPT_PENDING,
        message:
          `字幕がまだ生成されていません（公開: ${probe.publishedAt ?? "不明"}）。\n` +
          `  公開直後の動画は字幕未生成の可能性。数時間後に再試行してください。`,
      }
    }
    return {
      code: EXIT.TRANSCRIPT_DISABLED,
      message:
        `字幕が恒久的に無効です（公開: ${probe.publishedAt}、${TRANSCRIPT_PENDING_WINDOW_HOURS}時間以上経過）。\n` +
        `  このセッションは字幕からの抽出ができません。`,
    }
  }

  if (probe.captionLanguages.length > 0 && !probe.captionLanguages.some(l => l.startsWith("ja"))) {
    return {
      code: EXIT.TRANSCRIPT_DISABLED,
      message: `日本語字幕がありません（利用可能: ${probe.captionLanguages.join(", ")}）。`,
    }
  }

  const result = await fetchTranscript(videoId, url)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, result.text)

  return {
    code: EXIT.OK,
    message:
      `${path.relative(process.cwd(), outPath)}\n` +
      `  ${result.segments} セグメント / ${result.chars.toLocaleString()} 字 / ` +
      `${result.durationMinutes.toFixed(0)} 分` +
      (probe.title ? `\n  ${probe.title}` : ""),
  }
}

async function main() {
  const { url, out, force } = parseArgs(process.argv.slice(2))
  const { code, message } = await fetchTranscriptToFile(url, path.resolve(out), force)

  if (code === EXIT.OK) console.log(`✅ ${message}`)
  else if (code === EXIT.TRANSCRIPT_PENDING) console.warn(`⏳ ${message}`)
  else if (code === EXIT.TRANSCRIPT_DISABLED) console.warn(`⛔ ${message}`)
  else console.error(`❌ ${message}`)

  process.exit(code)
}

if (path.basename(process.argv[1] ?? "") === "fetch-transcript.ts") {
  main().catch((err) => {
    console.error(`❌ fetch-transcript failed: ${err instanceof Error ? err.message : err}`)
    process.exit(EXIT.ERROR)
  })
}
