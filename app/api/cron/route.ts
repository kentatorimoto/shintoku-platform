import { execSync } from "child_process"

export async function GET() {
  try {
    execSync("npm run sync", { stdio: "inherit" })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false })
  }
}
