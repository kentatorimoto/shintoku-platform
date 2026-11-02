import { execSync } from "child_process"

function runStep(name: string, cmd: string, required = false) {
  try {
    console.log(`Running ${name}...`)
    execSync(cmd, { stdio: "inherit" })
  } catch {
    if (required) {
      console.error(`❌ ${name} failed`)
      process.exit(1)
    }
    console.error(`❌ ${name} failed but continuing`)
  }
}

runStep("announcements", "npm run scrape:announcements")
// 広報は号が減ったときに失敗して知らせる（scrape-newsletters.ts）。ここで握りつぶさない
runStep("newsletters", "npm run scrape:newsletters", true)
runStep("index newsletters", "npm run index:newsletters", true)

// public/data/lastSync.json は書かない。
//
// 画面のどこからも読まれていないのに中身が日付1行なので、毎日かならず差分が出て
// 本番ビルドが1回走っていた。過去30日でこのワークフローの実質的な内容変更は
// 2回だけだったのに、コミットは30回。詳細は tasks/todo.md。

console.log("Sync complete")
