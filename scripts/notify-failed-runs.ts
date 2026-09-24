// 失敗したワークフロー実行を拾って Telegram に流す。
//
//   npx tsx scripts/notify-failed-runs.ts [--dry-run] [--days 3]
//
// なぜスクリプトなのか:
//   ワークフローの **起動失敗（startup_failure）では workflow_run イベントが発火しない**。
//   実際に watch-council を起動失敗させて確かめた（notify-failures の実行は0件だった）。
//   起動失敗はYAMLの不備や権限不足で起きる＝いちばん気づきたい失敗なので、
//   イベントに頼らず GitHub API を定期的に掃く。
//
// 同じ実行を二度知らせないよう、通知済みの run id を data/watch/notified-runs.json に残す。

import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"
import { EXIT } from "./config"
import { notify } from "./lib/telegram"

const ROOT = process.cwd()
const STATE_PATH = path.join(ROOT, "data", "watch", "notified-runs.json")

/** 人の対処が要る結末だけを拾う。cancelled は人が止めた結果なので鳴らさない。 */
const FAILED = new Set(["failure", "startup_failure", "timed_out"])

/** 状態ファイルに残す件数。古いものから捨てる（無限に伸ばさない）。 */
const KEEP = 200

interface Run {
  id:         number
  name:       string
  conclusion: string | null
  status:     string
  html_url:   string
  head_branch: string
  head_sha:   string
  event:      string
  created_at: string
}

const HEADLINE: Record<string, string> = {
  startup_failure: "🧨 ワークフローが起動できませんでした（YAMLか権限の問題）",
  timed_out:       "⏱ ワークフローがタイムアウトしました",
  failure:         "🔴 ワークフローが失敗しました",
}

function loadNotified(): Set<number> {
  if (!fs.existsSync(STATE_PATH)) return new Set()
  const data = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as { runIds: number[] }
  return new Set(data.runIds)
}

function saveNotified(ids: Set<number>) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  const kept = [...ids].sort((a, b) => b - a).slice(0, KEEP)
  fs.writeFileSync(STATE_PATH, JSON.stringify({ runIds: kept }, null, 2) + "\n")
}

function fetchRuns(): Run[] {
  const raw = execFileSync("gh", [
    "api", "repos/{owner}/{repo}/actions/runs?per_page=50",
    "--jq", ".workflow_runs",
  ], { cwd: ROOT, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 })
  return JSON.parse(raw) as Run[]
}

async function main() {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes("--dry-run")
  const days = Number(argv[argv.indexOf("--days") + 1]) || 3

  const since = Date.now() - days * 86_400_000
  const notified = loadNotified()

  // 自分自身の失敗を自分で拾っても意味がないので除く
  const runs = fetchRuns().filter(r =>
    r.status === "completed" &&
    r.conclusion !== null &&
    FAILED.has(r.conclusion) &&
    Date.parse(r.created_at) >= since &&
    r.name !== "Notify Workflow Failures" &&
    !notified.has(r.id),
  )

  console.log(`直近 ${days} 日の失敗: ${runs.length} 件（通知済み ${notified.size} 件）`)

  for (const run of runs.sort((a, b) => a.id - b.id)) {
    console.log(`  ${run.name} / ${run.conclusion} / ${run.html_url}`)
    if (dryRun) continue

    await notify("ci", HEADLINE[run.conclusion!] ?? HEADLINE.failure, [
      `${run.name}（${run.conclusion}）`,
      `ブランチ: ${run.head_branch} / ${run.head_sha.slice(0, 7)}`,
      `きっかけ: ${run.event}`,
      run.html_url,
    ])
    notified.add(run.id)
  }

  if (!dryRun && runs.length > 0) {
    saveNotified(notified)
    console.log(`📝 ${path.relative(ROOT, STATE_PATH)} を更新しました`)
  }
}

if (path.basename(process.argv[1] ?? "") === "notify-failed-runs.ts") {
  main().catch((err) => {
    console.error(`❌ notify-failed-runs failed: ${err instanceof Error ? err.message : err}`)
    process.exit(EXIT.ERROR)
  })
}
