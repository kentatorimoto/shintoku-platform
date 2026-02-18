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

console.log("Updating last sync date...")
const today = new Date()
const date =
  today.getFullYear() + "." +
  String(today.getMonth() + 1).padStart(2, "0") + "." +
  String(today.getDate()).padStart(2, "0")

const file = path.join(process.cwd(), "data", "lastSync.json")
fs.writeFileSync(file, JSON.stringify({ date }, null, 2))

console.log("Sync complete:", date)
