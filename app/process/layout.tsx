import type { ReactNode } from "react"
import AzukiPaper from "@/components/AzukiPaper"

/**
 * /process 配下は小豆の紙。AzukiPaper が <html data-paper="azuki"> を立て、
 * globals.css の [data-paper="azuki"] が基調変数（--color-base 等）を小豆に上書きする。
 * 各ページのコンポーネントは常に --color-base 等を参照するだけで両方の紙で動く。
 */
export default function ProcessLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AzukiPaper />
      {children}
    </>
  )
}
