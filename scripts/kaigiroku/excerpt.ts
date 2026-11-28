// speeches.json からテーマのキーワードで発言を抜粋する。APIは呼ばない。
//
//   npm run kaigiroku:excerpt -- ekimae
//
//   content/traces/{theme}.excerpts.json   抜粋（Claude に渡す材料。public には出さない）
//   content/traces/{theme}.dropped.json    絞り込みで落とした発言（抜けを確かめるため）
//
// 長い発言は、キーワードのある段落とその前後1段落だけを残す。
// 議員の質問がヒットしたときは、キーワードを含まなくても直後の答弁を残す（問いと答えを切り離さないため）。
// 子ども議会は町長・職員の答弁だけを残し、答弁の中の児童・生徒の名前は置き換える（child-assembly.ts）。

import fs from "fs"
import path from "path"
import { childNames, maskChildNames } from "./child-assembly"
import type { Speech } from "./extract"
import { corpusPath } from "../lib/corpus"

const ROOT = process.cwd()
const KAIGIROKU_DIR = corpusPath("kaigiroku")
const MAP_PATH = path.join(ROOT, "data", "kaigiroku", "session-map.json")

export interface Theme {
  /** 1語でも当たれば抜粋する */
  core: string[]
  /** core に当たった発言のうち、テーマの話と読めるものの条件。外れたものは dropped に残す */
  narrow: RegExp
  /** 他の施設でも使う語。これだけに当たった発言は抜粋せず dropped に残す */
  broad: string[]
}

export const THEMES: Record<string, Theme> = {
  ekimae: {
    core: [
      "駅前", "駅周辺", "新得駅", "複合施設", "地域交流センター", "交流センター", "とくとく", "トクトク",
      "ステラステーション", "タウンマネジメント", "タウンマネージメント", "まちづくり会社", "街づくり会社",
      "温浴", "町営浴場", "町営の浴場",
    ],
    narrow: /駅前(再|周辺|広場|地域|整備|複合|施設|の整備)|駅周辺|再整備|とくとく|トクトク|交流センター|温浴|町営浴場|町営の浴場|タウンマネ|まちづくり会社|街づくり会社|ステラステーション/,
    broad: ["指定管理", "金融機関", "宿泊施設", "浴場"],
  },
}

export interface Excerpt {
  sessionKey: string
  date: string
  page: number
  agenda: string
  speaker: string
  role: string
  /** hit: キーワードを含む / answer: ヒットした質問の直後の答弁 */
  kind: "hit" | "answer"
  keywords: string[]
  text: string
}

const CHAIR = /^(議長|副議長|臨時議長|委員長|副委員長|臨時委員長)$/
const ASKER = /^(議員|委員)$/
/** 議長の「議題といたします」程度の短い発言は流れの材料にならない */
const PROCEDURAL_CHARS = 120

function trimToHits(text: string, words: string[]): string {
  const paragraphs = text.split("\n")
  const keep = new Set<number>()
  paragraphs.forEach((p, i) => {
    if (words.some(w => p.includes(w))) [i - 1, i, i + 1].forEach(n => keep.add(n))
  })
  const parts: string[] = []
  paragraphs.forEach((p, i) => {
    if (keep.has(i)) parts.push(p)
    else if (keep.has(i - 1)) parts.push("（中略）")
  })
  return parts.join("\n")
}

export interface Dropped extends Excerpt {
  reason: "narrow外" | "広い語のみ" | "手続き発言"
}

export function excerptSpeeches(sessionKey: string, speeches: Speech[], theme: Theme): { excerpts: Excerpt[]; dropped: Dropped[] } {
  const excerpts: Excerpt[] = []
  const dropped: Dropped[] = []

  speeches.forEach((s, i) => {
    const base = { sessionKey, date: s.date, page: s.page, agenda: s.agenda, speaker: s.speaker, role: s.role }
    const keywords = theme.core.filter(w => s.text.includes(w))
    if (keywords.length === 0) {
      const broad = theme.broad.filter(w => s.text.includes(w))
      if (broad.length > 0) dropped.push({ ...base, kind: "hit", keywords: broad, text: trimToHits(s.text, broad), reason: "広い語のみ" })
      return
    }
    const hit = { ...base, kind: "hit" as const, keywords, text: trimToHits(s.text, keywords) }
    if (CHAIR.test(s.role) && s.text.length < PROCEDURAL_CHARS) { dropped.push({ ...hit, reason: "手続き発言" }); return }
    if (!theme.narrow.test(s.text)) { dropped.push({ ...hit, reason: "narrow外" }); return }

    excerpts.push(hit)

    if (!ASKER.test(s.role)) return
    const next = speeches.slice(i + 1, i + 4).find(n => !CHAIR.test(n.role))
    if (next && !ASKER.test(next.role) && !theme.core.some(w => next.text.includes(w))) {
      excerpts.push({
        sessionKey, date: next.date, page: next.page, agenda: next.agenda, speaker: next.speaker, role: next.role,
        kind: "answer", keywords: [], text: next.text,
      })
    }
  })
  return { excerpts, dropped }
}

function main() {
  const name = process.argv[2]
  const theme = THEMES[name]
  if (!theme) throw new Error(`テーマが無い: ${name}（${Object.keys(THEMES).join(", ")}）`)

  const map = JSON.parse(fs.readFileSync(MAP_PATH, "utf-8")) as { sessionKey: string; start: string; child?: boolean }[]
  const ordered = [...map].sort((a, b) => (a.start < b.start ? -1 : 1))

  const all: Excerpt[] = []
  const dropped: Dropped[] = []
  for (const { sessionKey, child } of ordered) {
    const speeches = JSON.parse(fs.readFileSync(path.join(KAIGIROKU_DIR, sessionKey, "speeches.json"), "utf-8")) as Speech[]
    const r = excerptSpeeches(sessionKey, speeches, theme)
    if (child) {
      const names = childNames(speeches)
      const answer = <T extends Excerpt>(e: T) => !ASKER.test(e.role) && !CHAIR.test(e.role)
      const mask = <T extends Excerpt>(e: T) => ({ ...e, text: maskChildNames(e.text, names) })
      r.excerpts = r.excerpts.filter(answer).map(mask)
      r.dropped = r.dropped.filter(answer).map(mask)
    }
    all.push(...r.excerpts)
    dropped.push(...r.dropped)
  }

  const dir = path.join(ROOT, "content", "traces")
  fs.mkdirSync(dir, { recursive: true })
  const write = (file: string, rows: unknown[]) => fs.writeFileSync(path.join(dir, file), `[\n${rows.map(e => JSON.stringify(e)).join(",\n")}\n]\n`)
  write(`${name}.excerpts.json`, all)
  write(`${name}.dropped.json`, dropped)

  const chars = (rows: { text: string }[]) => rows.reduce((n, e) => n + e.text.length, 0).toLocaleString()
  console.log(`✅ 抜粋 ${all.length} 件 / ${chars(all)} 字`)
  for (const reason of ["narrow外", "広い語のみ", "手続き発言"] as const) {
    const rows = dropped.filter(d => d.reason === reason)
    console.log(`   落とした: ${reason} ${rows.length} 件 / ${chars(rows)} 字`)
  }
}

if (path.basename(process.argv[1] ?? "") === "excerpt.ts") main()
