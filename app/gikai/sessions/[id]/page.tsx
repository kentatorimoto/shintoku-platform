import { redirect } from "next/navigation"
import fs from "fs"
import path from "path"

interface GikaiSession {
  id: string
}

function getSessions(): GikaiSession[] {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "gikai_sessions.json")
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as GikaiSession[]
  } catch {
    return []
  }
}

export async function generateStaticParams() {
  const sessions = getSessions()
  return sessions.map(s => ({ id: s.id }))
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/gikai/sessions/${id}/0`)
}
