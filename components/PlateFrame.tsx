import type { ReactNode } from "react"

interface Props {
  children:   ReactNode
  className?: string
}

/**
 * 図郭フレーム。四隅にティック（外向きのかぎ括弧）が付く測量図・図版の枠。
 * トップの「最新の記録」と /process のトレース図で共用する。
 * 罫線色は textMain（--color-ink 相当の墨）で、亜麻・小豆どちらの紙でも成立する。
 * 正は docs/design/atlas-hybrid-warm.html の .plate / .trace-block。
 */
export default function PlateFrame({ children, className = "" }: Props) {
  // 四隅ティック。枠線から 8px 外へ出し、14px の L 字を描く。
  const tickBase = "absolute w-3.5 h-3.5 border-textMain pointer-events-none"
  return (
    <div className={`relative border-[1.5px] border-textMain rounded-[2px] ${className}`}>
      <span className={`${tickBase} -top-px -left-px border-t-[1.5px] border-l-[1.5px] -translate-x-2 -translate-y-2`} aria-hidden />
      <span className={`${tickBase} -top-px -right-px border-t-[1.5px] border-r-[1.5px] translate-x-2 -translate-y-2`} aria-hidden />
      <span className={`${tickBase} -bottom-px -left-px border-b-[1.5px] border-l-[1.5px] -translate-x-2 translate-y-2`} aria-hidden />
      <span className={`${tickBase} -bottom-px -right-px border-b-[1.5px] border-r-[1.5px] translate-x-2 translate-y-2`} aria-hidden />
      {children}
    </div>
  )
}
