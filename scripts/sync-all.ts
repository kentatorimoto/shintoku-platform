import fs from "fs"
import path from "path"

const today = new Date()
const date =
  today.getFullYear() + "." +
  String(today.getMonth() + 1).padStart(2, "0") + "." +
  String(today.getDate()).padStart(2, "0")

const file = path.join(process.cwd(), "data", "lastSync.json")

fs.writeFileSync(
  file,
  JSON.stringify({ date }, null, 2)
)

console.log("Last sync updated:", date)
