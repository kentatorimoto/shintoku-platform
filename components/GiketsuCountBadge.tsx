"use client"

import { useRouter } from "next/navigation"
import { LABELS } from "@/lib/labels"

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
      /* ホバーの地は中立の bg-hover。薄い茜地（bg-accent/10）に茜の文字を載せると
         カード地の上で 3.97:1 まで落ちる。.chipActive と同じ形に揃える。 */
      className="inline-flex items-center gap-1 text-[11px] font-medium
                 border border-accent text-accent
                 hover:bg-hover rounded-[3px] px-2 py-[2px] transition-colors"
    >
      {LABELS.giketsu.text} {count} 件 →
    </button>
  )
}
