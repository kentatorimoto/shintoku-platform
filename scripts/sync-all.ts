import { execSync } from "child_process"
import fs from "fs"
import path from "path"

console.log("Running announcements scraper...")
execSync("npm run scrape:announcements", { stdio: "inherit" })

console.log("Running newsletters scraper...")
execSync("npm run scrape:newsletters", { stdio: "inherit" })

console.log("Updating last sync date...")
const today = new Date()
const date =
  today.getFullYear() + "." +
  String(today.getMonth() + 1).padStart(2, "0") + "." +
  String(today.getDate()).padStart(2, "0")

const file = path.join(process.cwd(), "data", "lastSync.json")
fs.writeFileSync(file, JSON.stringify({ date }, null, 2))

console.log("Sync complete:", date)
