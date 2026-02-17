import { execSync } from "child_process"

export async function GET() {
  execSync("npx tsx scripts/sync-all.ts")

  return Response.json({ ok: true })
}
