import { execSync } from "child_process"
import fs from "fs"
import path from "path"

function runStep(name: string, cmd: string) {
  try {
    console.log(`Running ${name}...`)
    execSync(cmd, { stdio: "inherit" })
  } catch (e) {
    console.error(`❌ ${name} failed but continuing`)
  }
}

runStep("announcements", "npm run scrape:announcements")
runStep("newsletters", "npm run scrape:newsletters")
runStep("index newsletters", "npm run index:newsletters")

console.log("Updating last sync date...")
function formatJstDate(d = new Date()) {
  // JST = UTC+9 を固定で適用（GitHub ActionsのUTCでもズレない）
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0")
  const day = String(jst.getUTCDate()).padStart(2, "0")
  return `${y}.${m}.${day}`
}

const date = formatJstDate()

const file = path.join(process.cwd(), "public", "data", "lastSync.json")
fs.writeFileSync(file, JSON.stringify({ date }, null, 2) + "\n")

console.log("Sync complete:", date)
