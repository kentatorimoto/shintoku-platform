// 新しいセッションを字幕からMDまで一気に作り、PRまで出す。addSession.mjs の後継。
//
//   npm run add-session -- \
//     --id r8-2026-06-regular-2 \
//     --url "https://www.youtube.com/watch?v=XXXX" \
//     --type honkaigi --part day2 --label "最終日（6/19）" \
//     --title-official "令和8年定例第2回新得町議会" \
//     --date 2026-06-19 --tags "定例会,補正予算,観光"
//
// 冪等: 同じ --id --part で再実行しても字幕は取り直さない（--force で上書き）。
// 抽出のガチャを引き直したいときは --force-extract。
//
// exit code は scripts/config.ts の EXIT 規約に従う。

import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"
import Anthropic from "@anthropic-ai/sdk"
import yaml from "js-yaml"
import { EXIT, MODEL } from "./config"
import { collectNeedsReview, extractPart, partIndexOf, type PartType } from "./extract-md"
import { fetchTranscriptToFile } from "./fetch-transcript"
import { validateTags, type GikaiSession, type Part } from "./lib/schema"

const ROOT        = process.cwd()
const CONTENT_DIR = path.join(ROOT, "content")

// ── CLI ─────────────────────────────────────────────────────────────────────

interface Args {
  id:            string
  url:           string
  type:          PartType
  part:          string
  label:         string
  titleOfficial?: string
  date:          string
  tags?:         string[]
  noPr:          boolean
  force:         boolean
  forceExtract:  boolean
}

const USAGE = `使い方:
  npm run add-session -- --id <sessionId> --url <youtube-url> --type qna|honkaigi \\
    --part day1 --label "初日（6/3）" --date YYYY-MM-DD \\
    [--title-official "令和8年定例第2回新得町議会"] [--tags "定例会,補正予算"] \\
    [--no-pr] [--force] [--force-extract]`

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const id    = get("--id")
  const url   = get("--url")
  const type  = get("--type") as PartType | undefined
  const part  = get("--part")
  const label = get("--label")
  const date  = get("--date")

  if (!id || !url || !part || !label || !date || (type !== "qna" && type !== "honkaigi")) {
    throw new Error(USAGE)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date は YYYY-MM-DD 形式です: "${date}"`)

  return {
    id, url, type, part, label, date,
    titleOfficial: get("--title-official"),
    tags: get("--tags")?.split(",").map(t => t.trim()).filter(Boolean),
    noPr:         argv.includes("--no-pr"),
    force:        argv.includes("--force"),
    forceExtract: argv.includes("--force") || argv.includes("--force-extract"),
  }
}

// ── session.yaml の scaffold / parts 追記 ───────────────────────────────────

const loadYaml = (src: string) => yaml.load(src, { schema: yaml.CORE_SCHEMA })
const dumpYaml = (v: unknown) => yaml.dump(v, { lineWidth: -1, noRefs: true, quoteStyle: "double" })

/** 会議種別タグを id から推測する。曖昧なら null（--tags を必須にする）。 */
function guessMeetingTag(sessionId: string): string | null {
  if (/-regular-/.test(sessionId)) return "定例会"
  if (/-rinji-/.test(sessionId)) return "臨時会"
  if (/-tokubetsu|-basic-plan/.test(sessionId)) return "特別委員会"
  return null
}

function scaffoldSession(args: Args): { session: GikaiSession; created: boolean } {
  const dir = path.join(CONTENT_DIR, "sessions", args.id)
  const yamlPath = path.join(dir, "session.yaml")
  const partIndex = partIndexOf(args.part)

  fs.mkdirSync(path.join(dir, "transcripts"), { recursive: true })

  let session: GikaiSession
  let created = false

  if (fs.existsSync(yamlPath)) {
    session = loadYaml(fs.readFileSync(yamlPath, "utf-8")) as GikaiSession
  } else {
    created = true
    const meetingTag = guessMeetingTag(args.id)
    const tags = args.tags ?? (meetingTag ? [meetingTag] : [])
    if (tags.length === 0) {
      throw new Error(`${args.id} から会議種別を推測できません。--tags で指定してください。`)
    }
    session = {
      id:            args.id,
      officialTitle: args.titleOfficial ?? args.id,
      date:          args.date,
      tags,
      parts:         [],
    }
  }

  if (args.tags) session.tags = args.tags
  if (args.titleOfficial) session.officialTitle = args.titleOfficial

  const { errors, warnings } = validateTags(session.tags)
  warnings.forEach(w => console.warn(`   ⚠️  ${w}`))
  if (errors.length > 0) {
    throw new Error(`タグ規則違反（docs/content-schema.md §10）:\n  ${errors.join("\n  ")}`)
  }

  const part: Part = { label: args.label, youtube: args.url }
  const existing = session.parts[partIndex]
  // pdf / slidesDir は既存があれば保つ（スライドまわりは本パイプラインの管轄外）
  session.parts[partIndex] = existing ? { ...existing, label: args.label, youtube: args.url } : part

  for (let i = 0; i < session.parts.length; i++) {
    if (!session.parts[i]) throw new Error(`parts[${i}] が空です。--part は既存パートの直後から順に埋めてください。`)
  }

  fs.writeFileSync(yamlPath, dumpYaml(session))
  return { session, created }
}

// ── narrativeTitle の3案 ────────────────────────────────────────────────────

async function proposeNarrativeTitles(mdPath: string): Promise<string[]> {
  const body = fs.readFileSync(mdPath, "utf-8").slice(0, 20_000)
  const client = new Anthropic()

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system:
      "新得町議会のアーカイブサイト向けに、セッションの内容を一言で表す見出し（narrativeTitle）を考えます。\n" +
      "規律: 事実の再配置のみ。評価語（良い/悪い/すべき）や党派的な含意を書かない。20〜30字程度。\n" +
      "出力は3行だけ。各行 `1. ` `2. ` `3. ` で始め、他には何も書かない。",
    messages: [{ role: "user", content: `次の会議録から narrativeTitle の案を3つ出してください。\n\n${body}` }],
  })
  const message = await stream.finalMessage()
  const text = message.content.filter(b => b.type === "text").map(b => b.text).join("")

  return text
    .split("\n")
    .map(l => /^\s*\d\.\s*(.+)$/.exec(l)?.[1]?.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, 3)
}

/** 3案をコメントとして残し、第1案を仮置きする。PRレビューで人が選ぶ。 */
function writeNarrativeTitle(sessionId: string, titles: string[]) {
  if (titles.length === 0) return
  const yamlPath = path.join(CONTENT_DIR, "sessions", sessionId, "session.yaml")
  const session = loadYaml(fs.readFileSync(yamlPath, "utf-8")) as GikaiSession

  const ordered: GikaiSession = {
    id: session.id,
    officialTitle: session.officialTitle,
    narrativeTitle: titles[0],
    date: session.date,
    ...(session.sortDate ? { sortDate: session.sortDate } : {}),
    tags: session.tags,
    ...(session.summary ? { summary: session.summary } : {}),
    parts: session.parts,
  }

  const comments = [
    "# narrativeTitle の候補（AI提案・レビューで選ぶか書き直す）:",
    ...titles.map((t, i) => `#   ${i + 1}. ${t}`),
    "",
  ].join("\n")

  fs.writeFileSync(yamlPath, comments + dumpYaml(ordered))
}

// ── git / PR ────────────────────────────────────────────────────────────────

const git = (...a: string[]) => execFileSync("git", a, { cwd: ROOT, encoding: "utf-8" }).trim()

function buildPrBody(args: Args, mdPath: string, needsReview: string[]): string {
  const rel = path.relative(ROOT, mdPath)
  const review = needsReview.length > 0
    ? needsReview.map(l => `- [ ] \`${rel}\` ${l}`).join("\n")
    : "- なし"

  return `字幕から自動抽出したセッションです。**まだ \`reviewed: false\` です。**

| 項目 | 値 |
|---|---|
| セッションID | \`${args.id}\` |
| パート | \`${args.part}\`（${args.label}） |
| 種別 | \`${args.type}\` |
| 開催日 | ${args.date} |
| 動画 | ${args.url} |
| 抽出モデル | \`${MODEL}\` |

## 【要確認】マーク（${needsReview.length} 件）

字幕から確信をもって読み取れなかった箇所です。動画を確認して直してください。

${review}

## レビューチェックリスト

- [ ] 議員名が \`scripts/prompts/glossary.md\` の正式表記と一致している
- [ ] 数値（金額・人数・年度）が動画と一致している
- [ ] タグが \`docs/content-schema.md\` §10 の規則に沿っている
- [ ] \`narrativeTitle\` を3案から選ぶ / 書き直す（\`session.yaml\` のコメント参照）
- [ ] 上記をすべて確認したら frontmatter を \`reviewed: true\` に変更する

## 生成物

\`public/data/\` は \`npm run build:data\` の生成物です。**直接編集しないでください。**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
`
}

function createPr(args: Args, mdPath: string, needsReview: string[]) {
  const branch = `feat/session-${args.id}`
  const base = git("rev-parse", "--abbrev-ref", "HEAD")

  git("checkout", "-b", branch)
  git("add", "content", "public/data")
  git("commit", "-m",
    `feat(session): ${args.id} ${args.part} を字幕から抽出\n\n` +
    `動画: ${args.url}\n抽出モデル: ${MODEL}\n要確認マーク: ${needsReview.length} 件\n\n` +
    `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`)
  git("push", "-u", "origin", branch)

  execFileSync("gh", [
    "pr", "create",
    "--base", base,
    "--head", branch,
    "--title", `セッション追加: ${args.id} ${args.part}（${args.label}）`,
    "--body", buildPrBody(args, mdPath, needsReview),
  ], { cwd: ROOT, stdio: "inherit" })
}

// ── メイン ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))

  console.log(`\n📋 ${args.id} / ${args.part}（${args.label}）\n`)

  console.log("1. session.yaml を用意")
  const { created } = scaffoldSession(args)
  console.log(`   ${created ? "新規作成" : "既存に parts を追記"}`)

  console.log("\n2. 字幕を取得（Layer 0）")
  const transcriptPath = path.join(CONTENT_DIR, "sessions", args.id, "transcripts", `${args.part}.txt`)
  const fetched = await fetchTranscriptToFile(args.url, transcriptPath, args.force)
  if (fetched.code !== EXIT.OK) {
    console.error(`   ${fetched.message}`)
    process.exit(fetched.code)
  }
  console.log(`   ${fetched.message}`)

  console.log("\n3. Claude API で本文を抽出")
  const result = await extractPart(
    { sessionId: args.id, partFile: args.part, partIndex: partIndexOf(args.part),
      partType: args.type, sessionDate: args.date, sourceUrl: args.url },
    args.forceExtract,
  )
  console.log(`   ${path.relative(ROOT, result.mdPath)}（自己修正 ${result.rounds} 回）`)

  console.log("\n4. narrativeTitle の案を3つ出す")
  if (created) {
    const titles = await proposeNarrativeTitles(result.mdPath)
    writeNarrativeTitle(args.id, titles)
    titles.forEach((t, i) => console.log(`   ${i + 1}. ${t}`))
  } else {
    console.log("   既存セッションなのでスキップ")
  }

  console.log("\n5. 全体を検証（build:data → next build）")
  execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit" })

  const needsReview = collectNeedsReview(result.mdPath)

  if (args.noPr) {
    console.log(`\n✅ 完了（--no-pr のためPRは作りません）`)
  } else {
    console.log("\n6. ブランチを作ってPRを出す")
    createPr(args, result.mdPath, needsReview)
  }

  if (needsReview.length > 0) {
    console.log(`\n⚠️  要確認 ${needsReview.length} 件:`)
    needsReview.forEach(l => console.log(`   ${l}`))
  }
}

if (path.basename(process.argv[1] ?? "") === "add-session.ts") {
  main().catch((err) => {
    console.error(`\n❌ add-session failed:\n${err instanceof Error ? err.message : err}`)
    process.exit(EXIT.ERROR)
  })
}
