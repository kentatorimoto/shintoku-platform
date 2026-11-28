// 子ども議会の会議録。全文は非公開の corpus にだけ置く。
// 公開する抜粋・出来事には町長・職員の答弁だけを使い、質問者は名前を出さず CHILD_ASKER と書く。
// 答弁の中に出る質問者の名前も CHILD_ASKER に置き換える。

const CHILD_ASSEMBLY = /子ども議会/

export const CHILD_ASKER = "子ども議会の児童・生徒"

export const isChildAssembly = (title: string): boolean => CHILD_ASSEMBLY.test(title)

/** 子ども議会で「議員」と呼ばれる人（＝児童・生徒）の名前。発言者の欄と「〇〇議員」の呼び方から集める */
const CALLED = /(?<=^|[、。，,\s（(「・と班])([一-龥々ヶ]{2,6})議員/gm

export function childNames(speeches: { speaker: string; role: string; text: string }[]): string[] {
  const names = new Set<string>()
  for (const s of speeches) {
    if (s.role === "議員") names.add(s.speaker)
    for (const m of s.text.matchAll(CALLED)) names.add(m[1])
  }
  return [...names].sort((a, b) => b.length - a.length)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const MARK = "\u0000"

/** 答弁の中の児童・生徒の名前を CHILD_ASKER に置き換える。「A議員、B議員の」は1つにまとめる */
export function maskChildNames(text: string, names: string[]): string {
  if (names.length === 0) return text
  const out = text.replace(new RegExp(`(?:${names.map(escape).join("|")})(?:議員|さん|君|くん|ちゃん)?`, "g"), MARK)
  return out.replace(new RegExp(`${MARK}(?:[、・，,と及び]*${MARK})*`, "g"), CHILD_ASKER)
}
