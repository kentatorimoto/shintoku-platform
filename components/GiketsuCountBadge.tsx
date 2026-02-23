"use client"

import { useRouter } from "next/navigation"

interface Props {
  count: number
  sessionName: string
}

export default function GiketsuCountBadge({ count, sessionName }: Props) {
  const router = useRouter()

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        router.push(`/gikai?session=${encodeURIComponent(sessionName)}`)
      }}
      className="inline-flex items-center gap-1 text-xs font-medium
                 border border-accent/50 text-accent
                 hover:bg-accent/10 hover:border-accent
                 rounded-full px-2.5 py-0.5 transition-colors"
    >
      議決 {count} 件 →
    </button>
  )
}
