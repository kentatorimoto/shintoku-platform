import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "町の決定を読む | Shintoku Atlas",
  description: "新得町議会の議決結果。10年分・729件の議案・意見案の可決／否決を検索・閲覧できます。",
}

export default function GikaiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
