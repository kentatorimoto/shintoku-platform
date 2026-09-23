// 新着動画の Issue を拾って、字幕→MD→PR までを GitHub Actions 上で走らせる。
//
//   npm run auto-ingest -- [--dry-run] [--issue 17] [--limit 5]
//
// 人間に残る判断はPRレビューだけにする。機械が勝手に決めないもの:
//   - 対応表（scripts/lib/session-id-rules.ts）に無いパターン → Issue にコメントして停止
//   - テーマタグ・narrativeTitle の確定・要点カードの生成 → すべてレビュー後
//
// 生成物は必ず reviewed: false。cards:generate はここでは走らせない。
//
// 設計の要点:
//   1. 字幕取得 → session.yaml 追記 → 抽出 の順で進める。逆にすると、字幕待ちで
//      止まったときに parts だけ増えて、翌日の再試行で partIndex がずれる。
//   2. パートの処理に失敗したら session.yaml を処理前に戻し、MDを消す。
//      transcripts/ は Layer 0 なので残す（再取得が高い・内容は不変）。
//   3. 同じ会期の後続パートは、先行パートが入るまで進めない（day{n} の順序を守るため）。
//   4. 冪等。動画URLが既に session.yaml にあれば何もしない。

import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import { leadingComments, proposeNarrativeTitles, scaffoldSession, writeNarrativeTitle } from "./add-session"
import { EXIT, MODEL, TRANSCRIPT_RETRY_DAYS } from "./config"
import { readFrontmatter } from "./build-data"
import { collectNeedsReview, extractPart } from "./extract-md"
import { extractVideoId, fetchTranscriptToFile } from "./fetch-transcript"
import {
  daysSince, isRetryable, loadState, saveState, todayJst,
  type IngestState, type VideoRecord,
} from "./lib/ingest-state"
import { orderSessionKeys, type GikaiSession } from "./lib/schema"
import {
  infer, type Inference, type SessionRepo, type SessionSnapshot,
} from "./lib/session-id-rules"
import { notify } from "./lib/telegram"

const ROOT         = process.cwd()
const CONTENT_DIR  = path.join(ROOT, "content")
const SESSIONS_DIR = path.join(CONTENT_DIR, "sessions")

const ISSUE_TITLE_PREFIX = "[新着動画]"

// ── 外部コマンド ────────────────────────────────────────────────────────────

const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf-8" }).trim()
const gh  = (...args: string[]) => execFileSync("gh",  args, { cwd: ROOT, encoding: "utf-8" }).trim()
const npm = (...args: string[]) => execFileSync("npm", args, { cwd: ROOT, stdio: "inherit" })

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err))

// ── content/sessions の読み取り ─────────────────────────────────────────────

const sessionDir  = (id: string) => path.join(SESSIONS_DIR, id)
const sessionYaml = (id: string) => path.join(sessionDir(id), "session.yaml")

function loadSession(id: string): GikaiSession | null {
  const file = sessionYaml(id)
  if (!fs.existsSync(file)) return null
  return yaml.load(fs.readFileSync(file, "utf-8"), { schema: yaml.CORE_SCHEMA }) as GikaiSession
}

/** パートの開催日を partIndex 順に集める（MDの frontmatter が正）。 */
function partDates(id: string, session: GikaiSession): string[] {
  const dates: string[] = new Array(session.parts.length).fill("")
  const dir = sessionDir(id)
  if (!fs.existsSync(dir)) return dates

  for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".md"))) {
    const { data } = readFrontmatter(fs.readFileSync(path.join(dir, file), "utf-8"))
    const index = Number(data.part_index)
    const date  = String(data.session_date ?? "")
    if (Number.isInteger(index) && index >= 0 && date) dates[index] = date
  }
  // MDが無いパート（PDFスライドだけの旧セッション）は session.date で埋める
  return dates.map(d => d || session.date)
}

/**
 * ドライランでは何も書かないので、同じ会期の2本目以降が常に同じ partIndex になってしまう。
 * 「入れたことにする」分をここに積んで、実行時と同じ採番を見せる。実行時は常に空。
 */
const simulated = new Map<string, { added: number; dates: string[] }>()

const repo: SessionRepo = {
  listIds: () => {
    const onDisk = fs.existsSync(SESSIONS_DIR)
      ? fs.readdirSync(SESSIONS_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
      : []
    return [...new Set([...onDisk, ...simulated.keys()])].sort()
  },

  load: (id): SessionSnapshot | null => {
    const session = loadSession(id)
    const sim = simulated.get(id)
    if (!session) {
      if (!sim) return null
      return { id, partCount: sim.added, partDates: [...sim.dates], youtubeUrls: [] }
    }
    return {
      id,
      partCount:   session.parts.length + (sim?.added ?? 0),
      partDates:   [...partDates(id, session), ...(sim?.dates ?? [])],
      youtubeUrls: session.parts.map(p => p.youtube).filter((u): u is string => Boolean(u)),
    }
  },
}

/** ドライラン専用。次のパートの採番が1つ進んだ状態を作る。 */
function simulateAdded(sessionId: string, date: string) {
  const sim = simulated.get(sessionId) ?? { added: 0, dates: [] }
  sim.added += 1
  sim.dates.push(date)
  simulated.set(sessionId, sim)
}

/** 取り込み済み判定は動画IDで行う（URLは `&t=2s` などの揺れがある）。 */
function ingestedVideoIds(): Set<string> {
  const ids = new Set<string>()
  for (const id of repo.listIds()) {
    for (const url of repo.load(id)?.youtubeUrls ?? []) {
      const videoId = extractVideoId(url)
      if (videoId) ids.add(videoId)
    }
  }
  return ids
}

// ── session.yaml の書き戻し（先頭のコメントを保つ）──────────────────────────

/** narrativeTitle の候補コメントを消さずに session.yaml を書き換える。 */
function rewriteSession(id: string, mutate: (s: GikaiSession) => void) {
  const file = sessionYaml(id)
  const raw  = fs.readFileSync(file, "utf-8")

  const head = leadingComments(raw)
  const session = yaml.load(raw, { schema: yaml.CORE_SCHEMA }) as GikaiSession
  mutate(session)

  fs.writeFileSync(
    file,
    head + yaml.dump(orderSessionKeys(session), { lineWidth: -1, noRefs: true, quoteStyle: "double" }),
  )
}

/**
 * 「最終日」のパートを足したときだけ date を最終日に、sortDate を会期初日にする（スキーマ §2.1）。
 * 一般質問や初日の追加では date を動かさない。
 */
export function applyFinalDayDates(id: string, finalDate: string): string {
  let note = ""
  rewriteSession(id, session => {
    const first = partDates(id, session)[0] || session.date
    session.date = finalDate
    if (first && first !== finalDate) session.sortDate = first
    note = `date=${finalDate}${session.sortDate ? ` / sortDate=${session.sortDate}` : ""}`
  })
  return note
}

// ── 失敗したときの巻き戻し ──────────────────────────────────────────────────

interface Restore { (): void }

/**
 * session.yaml とMDを処理前の状態に戻す道具を作る。
 * transcripts/ は戻さない（Layer 0・再取得が高く、内容も変わらないため）。
 */
function snapshotForRestore(id: string, partFile: string): Restore {
  const dir      = sessionDir(id)
  const yamlPath = sessionYaml(id)
  const mdPath   = path.join(dir, `${partFile}.md`)

  const hadDir  = fs.existsSync(dir)
  const hadYaml = fs.existsSync(yamlPath)
  const yamlRaw = hadYaml ? fs.readFileSync(yamlPath, "utf-8") : null
  const hadMd   = fs.existsSync(mdPath)
  const mdRaw   = hadMd ? fs.readFileSync(mdPath, "utf-8") : null

  return () => {
    if (mdRaw !== null) fs.writeFileSync(mdPath, mdRaw)
    else if (fs.existsSync(mdPath)) fs.rmSync(mdPath)

    if (yamlRaw !== null) fs.writeFileSync(yamlPath, yamlRaw)
    else if (fs.existsSync(yamlPath)) fs.rmSync(yamlPath)

    // セッションごと新規だった場合、字幕以外は消して跡を残さない
    if (!hadDir && fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir)) {
        if (entry !== "transcripts") fs.rmSync(path.join(dir, entry), { recursive: true })
      }
    }
  }
}

/** 生成物が reviewed: false であることを確かめる（レビュー前のものを既読にしない）。 */
function assertNotReviewed(mdPath: string) {
  const { data } = readFrontmatter(fs.readFileSync(mdPath, "utf-8"))
  if (data.reviewed !== false) {
    throw new Error(`${path.relative(ROOT, mdPath)} の reviewed が false ではありません（自動生成物は必ず false）。`)
  }
}

// ── GitHub Issue ────────────────────────────────────────────────────────────

export interface IssueRef {
  number: number
  title:  string
  url:    string
}

const URL_RE = /https:\/\/www\.youtube\.com\/(?:watch\?v=|live\/)[\w-]{11}\S*/

function fetchIssues(limit: number): IssueRef[] {
  const raw = gh("issue", "list", "--state", "open", "--limit", String(limit), "--json", "number,title,body")
  const issues = JSON.parse(raw) as { number: number; title: string; body: string }[]

  return issues
    .filter(i => i.title.startsWith(ISSUE_TITLE_PREFIX))
    .map(i => ({ number: i.number, title: i.title, url: URL_RE.exec(i.body ?? "")?.[0] ?? "" }))
    .sort((a, b) => a.number - b.number)
}

/**
 * 同じ知らせを毎日書かないよう、1回だけコメントする。
 * 判定は「マーカー＋本文が完全一致」。理由が変わったときは書く価値があるので、そのときだけ新しく出す。
 */
function commentOnce(issue: number, marker: string, body: string, dryRun: boolean) {
  const tag = `<!-- auto-ingest:${marker} -->`
  const full = `${tag}\n${body}`

  if (dryRun) {
    console.log(`   (dry-run) #${issue} にコメント: ${marker}`)
    return
  }
  const raw = gh("issue", "view", String(issue), "--json", "comments")
  const { comments } = JSON.parse(raw) as { comments: { body: string }[] }
  if (comments.some(c => c.body.trim() === full.trim())) {
    console.log(`   #${issue} には同じ内容の ${marker} コメント済み（繰り返さない）`)
    return
  }
  gh("issue", "comment", String(issue), "--body", full)
  console.log(`   #${issue} にコメントしました（${marker}）`)
}

// ── 計画 ────────────────────────────────────────────────────────────────────

interface Plan {
  issue:     IssueRef
  videoId:   string
  inference: Inference
}

interface PartResult {
  plan:        Plan
  inference:   Inference
  mdPath:      string
  needsReview: string[]
  dateNote:    string
}

// ── パートの処理 ────────────────────────────────────────────────────────────

type PartOutcome =
  | { kind: "done";    result: PartResult }
  | { kind: "skipped"; note: string }
  | { kind: "halt";    status: VideoRecord["status"]; note: string }

async function processPart(plan: Plan, state: IngestState, dryRun: boolean): Promise<PartOutcome> {
  const { issue, videoId } = plan
  const today = todayJst()

  // ブランチ上の最新状態で推定し直す（先行パートが入って partIndex が動くため）
  const res = infer(issue.title, repo)
  if (!res.ok) {
    return { kind: "halt", status: "blocked", note: res.reason }
  }
  const inf = res.inference

  const snapshot = repo.load(inf.sessionId)
  if (snapshot?.youtubeUrls.some(u => extractVideoId(u) === videoId)) {
    return { kind: "skipped", note: "この動画は既に session.yaml にあります（取り込み済み）" }
  }
  if (snapshot && snapshot.partCount !== inf.partIndex) {
    return { kind: "halt", status: "failed", note: `partIndex の不整合（既存 ${snapshot.partCount} / 推定 ${inf.partIndex}）` }
  }

  console.log(`\n── #${issue.number} ${issue.title}`)
  inf.trace.forEach(t => console.log(`   ${t}`))

  if (dryRun) {
    simulateAdded(inf.sessionId, inf.date)
    return {
      kind: "done",
      result: { plan, inference: inf, mdPath: "", needsReview: [], dateNote: "" },
    }
  }

  // 1. 字幕（Layer 0）。ここで止まる場合は session.yaml を触らない
  const transcriptPath = path.join(sessionDir(inf.sessionId), "transcripts", `${inf.partFile}.txt`)
  const fetched = await fetchTranscriptToFile(plan.issue.url, transcriptPath)

  if (fetched.code === EXIT.TRANSCRIPT_PENDING) {
    const record = state.videos[videoId]
    const firstSeen = record?.firstSeen ?? today
    const waited = daysSince(firstSeen)

    if (waited >= TRANSCRIPT_RETRY_DAYS) {
      commentOnce(issue.number, "gave-up",
        `字幕の生成を ${TRANSCRIPT_RETRY_DAYS} 日待ちましたが、まだ生成されていません。自動取り込みは諦めます。\n\n` +
        `${fetched.message}\n\n字幕が付いたら、この Issue を閉じずに auto-ingest ワークフローを手動実行してください。`,
        dryRun)
      return { kind: "halt", status: "gave_up", note: `字幕待ち ${waited} 日で諦め` }
    }
    return { kind: "halt", status: "pending", note: `字幕が未生成（待機 ${waited} 日 / 上限 ${TRANSCRIPT_RETRY_DAYS} 日）` }
  }

  if (fetched.code === EXIT.TRANSCRIPT_DISABLED) {
    commentOnce(issue.number, "disabled",
      `**字幕が恒久的に無効です。** このパートは字幕から抽出できないため、自動取り込みを中止しました。\n\n` +
      "```\n" + fetched.message + "\n```", dryRun)
    return { kind: "halt", status: "disabled", note: fetched.message.split("\n")[0] }
  }

  if (fetched.code !== EXIT.OK) {
    commentOnce(issue.number, "error",
      `**字幕を取得できませんでした。** 人手での対処が要ります。\n\n` +
      "```\n" + fetched.message + "\n```", dryRun)
    return { kind: "halt", status: "failed", note: fetched.message.split("\n")[0] }
  }
  console.log(`   字幕: ${fetched.message.split("\n")[0]}`)

  // 2〜4. session.yaml → 抽出 → 検証。落ちたら処理前に戻す
  const restore = snapshotForRestore(inf.sessionId, inf.partFile)
  try {
    scaffoldSession({
      id:    inf.sessionId,
      url:   issue.url,
      part:  inf.partFile,
      label: inf.label,
      date:  inf.date,
      ...(inf.isNewSession
        ? { tags: inf.newSessionTags, titleOfficial: inf.newSessionOfficialTitle }
        : {}),
    })

    const extracted = await extractPart({
      sessionId:   inf.sessionId,
      partFile:    inf.partFile,
      partIndex:   inf.partIndex,
      partType:    inf.type,
      sessionDate: inf.date,
      sourceUrl:   issue.url,
    })
    assertNotReviewed(extracted.mdPath)

    if (inf.isNewSession) {
      writeNarrativeTitle(inf.sessionId, await proposeNarrativeTitles(extracted.mdPath))
    }

    const dateNote = inf.isFinalDay ? applyFinalDayDates(inf.sessionId, inf.date) : ""
    if (dateNote) console.log(`   会期の日付を更新: ${dateNote}`)

    npm("run", "build:data")

    git("add", "content", "public/data")
    git("commit", "-m",
      `feat(session): ${inf.sessionId} ${inf.partFile} を字幕から抽出\n\n` +
      `Issue: #${issue.number}\n動画: ${issue.url}\n抽出モデル: ${MODEL}\n` +
      `要確認マーク: ${extracted.needsReview.length} 件\nreviewed: false（レビュー前）`)

    return {
      kind: "done",
      result: {
        plan, inference: inf,
        mdPath:      extracted.mdPath,
        needsReview: collectNeedsReview(extracted.mdPath),
        dateNote,
      },
    }
  } catch (err) {
    restore()
    commentOnce(issue.number, "error",
      `**自動取り込みに失敗しました。** 人手での対処が要ります。\n\n` +
      "```\n" + errText(err) + "\n```\n\n" +
      `content/ は処理前の状態に戻してあります（字幕 \`transcripts/${inf.partFile}.txt\` は残置）。`,
      dryRun)
    return { kind: "halt", status: "failed", note: errText(err).split("\n")[0] }
  }
}

// ── PR ──────────────────────────────────────────────────────────────────────

/**
 * PR本文の1行分。**その回に処理したパートだけでなく、ブランチに載っている全パート**を
 * 状態ファイルから組み直す（後続パートを積んだときに前のパートの記述が消えないように）。
 */
interface PrEntry {
  issue:       number
  issueTitle:  string
  url:         string
  partFile:    string
  label:       string
  partType:    string
  date:        string
  trace:       string[]
  dateNote:    string
  mdPath:      string
  needsReview: string[]
}

const partOrder = (partFile: string) => Number(/(\d+)$/.exec(partFile)?.[1] ?? 0)

function prEntries(sessionId: string, state: IngestState): PrEntry[] {
  return Object.values(state.videos)
    .filter(r => r.sessionId === sessionId && r.status === "done" && r.partFile)
    .sort((a, b) => partOrder(a.partFile!) - partOrder(b.partFile!))
    .map(r => {
      const mdPath = path.join(sessionDir(sessionId), `${r.partFile}.md`)
      return {
        issue:       r.issue,
        issueTitle:  r.title.replace(ISSUE_TITLE_PREFIX, "").trim(),
        url:         r.url,
        partFile:    r.partFile!,
        label:       r.label ?? "",
        partType:    r.partType ?? "",
        date:        r.date ?? "",
        trace:       r.trace ?? [],
        dateNote:    r.dateNote ?? "",
        mdPath,
        needsReview: fs.existsSync(mdPath) ? collectNeedsReview(mdPath) : [],
      }
    })
}

function buildPrBody(sessionId: string, entries: PrEntry[], buildOk: boolean): string {
  const rows = entries.map(e =>
    `| \`${e.partFile}\` | ${e.label} | ${e.partType} | ${e.date} | ` +
    `[動画](${e.url}) | #${e.issue} | ${e.needsReview.length} 件 |`,
  ).join("\n")

  const traces = entries.map(e =>
    `### \`${e.partFile}\` ← #${e.issue}「${e.issueTitle}」\n\n` +
    e.trace.map(t => `- ${t}`).join("\n") +
    (e.dateNote ? `\n- 会期の日付を更新: ${e.dateNote}` : ""),
  ).join("\n\n")

  const review = entries.flatMap(e =>
    e.needsReview.map(l => `- [ ] \`${path.relative(ROOT, e.mdPath)}\` ${l}`),
  )
  const dateUpdated = entries.some(e => e.dateNote)

  return `字幕から自動抽出しました。**すべて \`reviewed: false\` です。**

| パート | ラベル | 種別 | 開催日 | 動画 | Issue | 要確認 |
|---|---|---|---|---|---|---|
${rows}

| 項目 | 値 |
|---|---|
| セッションID | \`${sessionId}\` |
| 抽出モデル | \`${MODEL}\` |
| 検証 | ${buildOk ? "✅ `npm run build` 成功" : "❌ `npm run build` 失敗（ログを確認してください）"} |

## 推定の根拠

対応表は \`scripts/lib/session-id-rules.ts\`（表の全文は \`docs/auto-ingest.md\`）。
**推定が外れていたら、どの規則が誤動作したかをここで特定できます。**

${traces}

## 【要確認】マーク（${review.length} 件）

字幕から確信をもって読み取れなかった箇所です。動画を確認して直してください。

${review.length > 0 ? review.join("\n") : "- なし"}

## レビューチェックリスト

- [ ] **推定の根拠（上）が実際の会議と合っている** — 特に開催日。タイトルの日付を採り、動画の公開日は見ていません
- [ ] 議員名が \`scripts/prompts/glossary.md\` の正式表記と一致している
- [ ] 数値（金額・人数・年度）が動画と一致している
- [ ] タグが \`docs/content-schema.md\` §10 の規則に沿っている（テーマタグは自動では付けていません）
- [ ] \`narrativeTitle\` を3案から選ぶ / 書き直す（\`session.yaml\` のコメント参照）${dateUpdated ? "\n- [ ] `date` / `sortDate` の更新が会期と合っている（§2.1）" : ""}
- [ ] すべて確認したら frontmatter を \`reviewed: true\` に変更する
- [ ] マージ後、必要なら \`npm run cards:generate -- ${sessionId}\`（要点カードはレビュー後の工程）

## 生成物

\`public/data/\` は \`npm run build:data\` の生成物です。**直接編集しないでください。**

${entries.map(e => `Closes #${e.issue}`).join("\n")}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
`
}

function openOrUpdatePr(branch: string, baseBranch: string, sessionId: string, entries: PrEntry[], buildOk: boolean): string {
  const body = buildPrBody(sessionId, entries, buildOk)
  const existing = JSON.parse(
    gh("pr", "list", "--head", branch, "--state", "open", "--json", "number,url"),
  ) as { number: number; url: string }[]

  const title = `セッション追加: ${sessionId}（${entries.length}パート・レビュー前）`

  if (existing.length > 0) {
    gh("pr", "edit", String(existing[0].number), "--title", title, "--body", body)
    return existing[0].url
  }
  // gh pr create は作成したPRのURLを標準出力の最終行に出す
  const out = gh("pr", "create", "--base", baseBranch, "--head", branch, "--title", title, "--body", body)
  return out.split("\n").filter(l => l.startsWith("https://")).pop() ?? out.trim()
}

// ── セッション単位の処理 ────────────────────────────────────────────────────

/** 既にリモートにあれば その上に積む。無ければ base から作る。 */
function ensureBranch(branch: string, baseBranch: string) {
  try {
    git("fetch", "origin", branch)
    git("checkout", "-B", branch, "FETCH_HEAD")
    console.log(`   既存ブランチ ${branch} に積みます`)
  } catch {
    git("checkout", "-B", branch, baseBranch)
    console.log(`   ブランチ ${branch} を ${baseBranch} から作成`)
  }
}

/** 戻り値は「人間の対処が要る件数」。ワークフローの終了コードに反映する。 */
async function processSession(
  sessionId: string,
  plans: Plan[],
  state: IngestState,
  baseBranch: string,
  dryRun: boolean,
): Promise<number> {
  console.log(`\n${"─".repeat(70)}\n📦 ${sessionId}（${plans.length} パート）`)

  const branch = `auto/session-${sessionId}`
  if (!dryRun) ensureBranch(branch, baseBranch)

  const today = todayJst()
  const results: PartResult[] = []
  let halted: string | null = null
  let problems = 0

  for (const plan of plans) {
    const previous = state.videos[plan.videoId]
    const record: VideoRecord = {
      issue:     plan.issue.number,
      title:     plan.issue.title,
      url:       plan.issue.url,
      status:    "pending",
      sessionId,
      partFile:  plan.inference.partFile,
      label:     plan.inference.label,
      partType:  plan.inference.type,
      date:      plan.inference.date,
      trace:     plan.inference.trace,
      firstSeen: previous?.firstSeen ?? today,
      lastTried: today,
      attempts:  (previous?.attempts ?? 0) + 1,
    }

    if (halted) {
      state.videos[plan.videoId] = { ...record, status: "pending", note: `先行パートの取り込み待ち（${halted}）` }
      console.log(`   ⏸  #${plan.issue.number} は先行パート待ちで見送り`)
      continue
    }

    const outcome = await processPart(plan, state, dryRun)

    if (outcome.kind === "done") {
      const inf = outcome.result.inference
      results.push(outcome.result)
      state.videos[plan.videoId] = {
        ...record,
        status:   "done",
        partFile: inf.partFile,
        label:    inf.label,
        partType: inf.type,
        date:     inf.date,
        trace:    inf.trace,
        dateNote: outcome.result.dateNote || undefined,
      }
      continue
    }

    if (outcome.kind === "skipped") {
      state.videos[plan.videoId] = { ...record, status: "done", note: outcome.note }
      console.log(`   ⏭  #${plan.issue.number}: ${outcome.note}`)
      continue
    }

    state.videos[plan.videoId] = { ...record, status: outcome.status, note: outcome.note }
    halted = `#${plan.issue.number}`
    // 字幕待ち（pending）は想定内。それ以外は人間の対処が要る
    if (outcome.status !== "pending") problems += 1
    console.log(`   ⛔ #${plan.issue.number}: ${outcome.note}`)

    if (outcome.status === "pending" || outcome.status === "gave_up") {
      const givingUp = outcome.status === "gave_up"
      // 保留の通知は初回と諦めたときだけ。毎日同じ知らせを送らない
      if (givingUp || record.attempts === 1) {
        await notify("pending", `${sessionId} ${plan.inference.partFile}`, [
          `Issue: #${plan.issue.number}「${plan.issue.title}」`,
          outcome.note,
          givingUp ? "自動取り込みは諦めました。手で対処してください。" : "翌日の実行で再試行します。",
        ])
      }
    } else if (previous?.note !== outcome.note) {
      // 同じ理由で毎日鳴らさない。理由が変わったときだけ知らせる
      await notify("blocked", `${sessionId} ${plan.inference.partFile}`, [
        `Issue: #${plan.issue.number}「${plan.issue.title}」`,
        outcome.note,
        "Issue にコメントを残しました。",
      ])
    } else {
      console.log(`   （前回と同じ理由なので通知しません）`)
    }
  }

  if (dryRun) return problems

  if (results.length === 0) {
    git("checkout", baseBranch)
    console.log("   新しく入ったパートが無いので、PRは作りません")
    return problems
  }

  console.log("\n   全体を検証（npm run build）")
  let buildOk = true
  try {
    npm("run", "build")
  } catch (err) {
    buildOk = false
    problems += 1
    console.error(`   ⚠️  build に失敗しましたが、PRは作って人の目に入れます: ${errText(err)}`)
  }

  git("push", "-u", "origin", branch)

  // ブランチに載っている全パート（前回までの分を含む）でPR本文を組み直す
  const prUrl = openOrUpdatePr(branch, baseBranch, sessionId, prEntries(sessionId, state), buildOk)
  console.log(`   ✅ ${prUrl}`)

  for (const r of results) {
    const saved = state.videos[r.plan.videoId]
    if (saved) saved.prUrl = prUrl
  }

  await notify("pr", `${sessionId}（今回 ${results.length} パート）`, [
    prUrl,
    ...results.map(r => `・${r.inference.partFile} ${r.inference.label}（要確認 ${r.needsReview.length} 件）`),
    buildOk ? "" : "⚠️ npm run build に失敗しています。",
    "レビューして reviewed: true にしてからマージしてください。",
  ].filter(Boolean))

  git("checkout", baseBranch)
  return problems
}

// ── メイン ──────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    dryRun:     argv.includes("--dry-run"),
    notifyTest: argv.includes("--notify-test"),
    issue:      get("--issue") ? Number(get("--issue")) : null,
    limit:      Number(get("--limit") ?? 50),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  // Secrets の疎通確認だけして終わる。取り込みは何もしない
  if (args.notifyTest) {
    await notify("test", "auto-ingest からの疎通確認です", [
      `実行: ${new Date().toISOString()}`,
      "これが届いていれば TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID は正しく設定されています。",
    ])
    return
  }

  const state = loadState()
  const base = git("rev-parse", "--abbrev-ref", "HEAD")

  console.log(`🤖 auto-ingest${args.dryRun ? "（dry-run）" : ""} / base=${base}`)

  const issues = fetchIssues(args.limit).filter(i => args.issue === null || i.number === args.issue)
  const ingested = ingestedVideoIds()
  const plans: Plan[] = []
  // 人間の対処が要る件数。1件でもあればワークフローを赤くする（通知が落ちていても気づけるように）
  let problems = 0

  for (const issue of issues) {
    const videoId = issue.url ? extractVideoId(issue.url) : null
    if (!videoId) {
      console.log(`⚠️  #${issue.number}: 本文から動画URLを読み取れませんでした`)
      continue
    }

    const record = state.videos[videoId]
    if (record && !isRetryable(record)) {
      console.log(`⏭  #${issue.number}: ${record.status}（対象外）`)
      continue
    }
    if (ingested.has(videoId)) {
      const duplicate = record && record.issue !== issue.number
      console.log(`⏭  #${issue.number}: 取り込み済み${duplicate ? `（#${record.issue} と同じ動画）` : ""}`)

      if (duplicate) {
        commentOnce(issue.number, "duplicate",
          `この動画（\`${videoId}\`）は #${record.issue} で取り込み済みです。重複 Issue なので閉じてください。`,
          args.dryRun)
      }
      state.videos[videoId] = {
        // 最初に取り込んだ Issue 番号を残す（重複で上書きしない）
        issue:     record?.issue ?? issue.number,
        title:     record?.title ?? issue.title,
        url:       record?.url ?? issue.url,
        status:    "done",
        sessionId: record?.sessionId,
        partFile:  record?.partFile,
        label:     record?.label,
        partType:  record?.partType,
        date:      record?.date,
        trace:     record?.trace,
        firstSeen: record?.firstSeen ?? todayJst(),
        lastTried: todayJst(),
        attempts:  record?.attempts ?? 0,
        note:      duplicate ? `#${record.issue} で取り込み済み（#${issue.number} は重複）` : "既に session.yaml にある",
      }
      continue
    }

    const res = infer(issue.title, repo)
    if (!res.ok) {
      console.log(`🛑 #${issue.number}: ${res.reason}`)
      problems += 1
      state.videos[videoId] = {
        issue: issue.number, title: issue.title, url: issue.url, status: "blocked",
        trace: res.trace, firstSeen: record?.firstSeen ?? todayJst(), lastTried: todayJst(),
        attempts: (record?.attempts ?? 0) + 1, note: res.reason,
      }
      // 同じ理由で毎日通知しない（表を直せば次の実行で進む）
      if (record?.note !== res.reason) {
        commentOnce(issue.number, "blocked",
          `**対応表から推定できませんでした。** 自動取り込みを止めています。\n\n` +
          `理由: ${res.reason}\n\n` +
          `推定の途中経過:\n${res.trace.map(t => `- ${t}`).join("\n")}\n\n` +
          `対応: \`scripts/lib/session-id-rules.ts\` の表に追加するか（\`docs/auto-ingest.md\` 参照）、` +
          `\`npm run add-session\` で手動取り込みしてください。`,
          args.dryRun)
        await notify("blocked", issue.title, [`Issue: #${issue.number}`, res.reason])
      }
      continue
    }

    plans.push({ issue, videoId, inference: res.inference })
  }

  if (plans.length === 0) {
    console.log("\n取り込む動画はありません。")
  }

  // 会期ごとにまとめ、同じ会期の中は（開催日 → 同日内の順序 → Issue番号）で積む
  const grouped = new Map<string, Plan[]>()
  for (const plan of plans) {
    const list = grouped.get(plan.inference.sessionId) ?? []
    list.push(plan)
    grouped.set(plan.inference.sessionId, list)
  }
  for (const list of grouped.values()) {
    list.sort((a, b) =>
      a.inference.date.localeCompare(b.inference.date) ||
      a.inference.ordinal - b.inference.ordinal ||
      a.issue.number - b.issue.number)
  }

  for (const [sessionId, list] of [...grouped.entries()].sort()) {
    problems += await processSession(sessionId, list, state, base, args.dryRun)
  }

  if (args.dryRun) {
    printPlan(state)
  } else {
    git("checkout", base)
    saveState(state)
    console.log(`\n📝 data/watch/ingest-state.json を更新しました`)
  }

  if (problems > 0) {
    console.error(`\n❌ 人間の対処が要る件数: ${problems}（詳細は Issue のコメントを見てください）`)
    process.exit(EXIT.ERROR)
  }
}

/** ドライランの結果を、確認しやすい1枚の表にする。 */
function printPlan(state: IngestState) {
  const rows = Object.values(state.videos)
    .filter(r => r.partFile)
    .sort((a, b) => (a.sessionId ?? "").localeCompare(b.sessionId ?? "") ||
                    (a.date ?? "").localeCompare(b.date ?? "") ||
                    a.issue - b.issue)

  console.log("\n推定結果:\n")
  console.log("| Issue | タイトル | セッションID | part | type | label | date |")
  console.log("|---|---|---|---|---|---|---|")
  for (const r of rows) {
    console.log(
      `| #${r.issue} | ${r.title.replace(ISSUE_TITLE_PREFIX, "").trim()} | ${r.sessionId} | ` +
      `${r.partFile} | ${r.partType} | ${r.label} | ${r.date} |`,
    )
  }
  console.log()
}

if (path.basename(process.argv[1] ?? "") === "auto-ingest.ts") {
  main().catch((err) => {
    console.error(`\n❌ auto-ingest failed:\n${errText(err)}`)
    process.exit(EXIT.ERROR)
  })
}
