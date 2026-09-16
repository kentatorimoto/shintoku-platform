/**
 * 文字色のコントラスト検査。回帰防止用。
 *
 * 3つのことを見る。
 *   1. 透過による文字の階調（text-textSub/70 等）が1件も無いこと
 *   2. 茜の面（bg-accent）を敷いた要素に文字色の指定があること
 *      — 書き忘れると親から textMain を継承し、茜の上で 2.58:1 になる
 *   3. 使われている「文字色 × 地色」の組み合わせがすべて WCAG AA（4.5:1）を満たすこと
 *
 * 階調の設計は docs/design/text-scale.md、値は app/globals.css の @theme が正。
 * このスクリプトは値を持たない（globals.css を読んで検査する）ので、
 * トークンを足しても書き換え不要。
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { EXIT } from "./config"

const ROOT = process.cwd()
const SCAN_DIRS = ["app", "components"]
const THEME_FILE = "app/globals.css"

/** AA の下限。大きい文字の 3:1 例外は使わない（このパレットは全段 4.5 を満たせるため）。 */
const AA = 4.5

// ── 色 ──────────────────────────────────────────────────────────────────────

type Rgb = { r: number; g: number; b: number }

function parseHex(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** WCAG 2.x の相対輝度 */
function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(fg: Rgb, bg: Rgb): number {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** 半透明の地を不透明な面の上に合成する。bg-accent/20 のような指定を実測可能にする。 */
function composite(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
  }
}

// ── トークン ─────────────────────────────────────────────────────────────────

/** app/globals.css の @theme から --color-* を読む。 */
function readTokens(): Record<string, string> {
  const css = readFileSync(join(ROOT, THEME_FILE), "utf8")
  const tokens: Record<string, string> = {}
  for (const m of css.matchAll(/--color-([A-Za-z0-9]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[m[1]] = m[2].toLowerCase()
  }
  // Tailwind 既定色のうち、この配色で実際に使うもの
  tokens.white = "#ffffff"
  tokens.black = "#000000"
  return tokens
}

// ── 走査 ─────────────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name !== "node_modules" && !name.startsWith(".")) walk(p, out)
    } else if (/\.(tsx?|css)$/.test(p)) {
      out.push(p)
    }
  }
  return out
}

type Finding = { file: string; line: number; detail: string }

/**
 * 文字色に地色が明示されていないときに想定する面。
 * .card が bg-ink なので、同じユーティリティが紙にもカードにも載る。両方で通す必要がある。
 */
const DEFAULT_SURFACES = ["paper", "ink"]

/**
 * 申告済みの例外。
 *
 * 地色が親要素にある（または画像の上に載る）場合、静的解析では追えない。
 * そういう箇所はソース側に `contrast-ok: 理由` と書いて除外する。理由を書かせるのは、
 * 黙って消せる抜け穴にしないため。文字ではない装飾・アイコンにも使う（AA は文字の規定）。
 */
const OPT_OUT = /contrast-ok:\s*(.+?)\s*(?:\*\/|$)/

/**
 * クラスのかたまりを1単位として取り出す。
 *
 * 行単位で見ると `className` が複数行に折り返されたときに破綻する。
 * 実際 GiketsuCountBadge は `text-accent` と `hover:bg-accent/10` が別の行にあり、
 * 行単位の検査では 3.97:1 を見逃していた。
 *
 * Tailwind のクラスは必ず文字列リテラル（tsx）か @apply（css）の中にあるので、
 * そこを1単位として切り出す。
 */
function classChunks(src: string, isCss: boolean): { text: string; line: number }[] {
  const chunks: { text: string; line: number }[] = []

  if (isCss) {
    for (const m of src.matchAll(/@apply\s+([^;]+);/g)) {
      chunks.push({ text: m[1], line: src.slice(0, m.index).split("\n").length })
    }
    return chunks
  }

  // 行コメントを落としてから文字列リテラルを拾う（説明文の例示を拾わないため）
  const cleaned = src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, " "))

  let line = 1
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i]
    if (c === "\n") { line++; continue }
    if (c !== '"' && c !== "'" && c !== "`") continue
    const quote = c
    const start = line
    let buf = ""
    i++
    for (; i < cleaned.length; i++) {
      const d = cleaned[i]
      if (d === "\\") { i++; continue }
      if (d === quote) break
      if (d === "\n") line++
      // テンプレートリテラルの ${...} は中身が式なので区切りとして扱う
      buf += d === "$" && cleaned[i + 1] === "{" ? " " : d
    }
    if (buf.includes("text-") || buf.includes("bg-")) chunks.push({ text: buf, line: start })
  }
  return chunks
}

async function main() {
  const tokens = readTokens()
  const files = SCAN_DIRS.flatMap(d => walk(join(ROOT, d)))

  const alphaText: Finding[] = []
  const aaFail: Finding[] = []
  const exempt: Finding[] = []
  const bareSurface: Finding[] = []
  const combos = new Map<string, { ratio: number; count: number }>()

  // variant（hover: / focus: …）は捨てずに拾う。捨てると「hover で地と文字が同時に変わる」
  // 指定が総当たりになり、実在しない組み合わせを未達として報告してしまう。
  const TEXT_RE = /(?:^|[\s])((?:(?:hover|focus|group-hover|active|placeholder|md|sm|lg|dark):)*)text-([A-Za-z][A-Za-z0-9]*)(?:\/(\d+))?(?=\s|$)/g
  const BG_RE = /(?:^|[\s])((?:(?:hover|focus|group-hover|active|md|sm|lg|dark):)*)bg-([A-Za-z][A-Za-z0-9]*)(?:\/(\d+))?(?=\s|$)/g

  /** レスポンシブ修飾子は状態ではないので、状態だけを取り出す（md:hover: → hover:）。 */
  const stateOf = (variants: string) =>
    variants.split(":").filter(v => ["hover", "focus", "group-hover", "active"].includes(v)).join(":")

  const resolveSurface = (token: string, alpha: number | null): Rgb | null => {
    const hex = tokens[token]
    if (!hex) return null
    const color = parseHex(hex)
    if (alpha === null) return color
    // 半透明の地は紙の上に合成する（カード地より紙の方が明るく、文字には不利な側）
    return composite(color, parseHex(tokens.paper), alpha / 100)
  }

  for (const abs of files) {
    const file = relative(ROOT, abs)
    const src = readFileSync(abs, "utf8")
    const lines = src.split("\n")

    for (const chunk of classChunks(src, abs.endsWith(".css"))) {
      const text = " " + chunk.text.replace(/\s+/g, " ") + " "
      const i = chunk.line - 1

      // 地色を状態ごとに集める（"" が通常状態）
      const surfaceByState = new Map<string, { name: string; color: Rgb }>()
      for (const m of text.matchAll(BG_RE)) {
        const c = resolveSurface(m[2], m[3] ? Number(m[3]) : null)
        if (c) surfaceByState.set(stateOf(m[1]), { name: m[3] ? `${m[2]}/${m[3]}` : m[2], color: c })
      }
      const baseSurfaces = surfaceByState.has("")
        ? [surfaceByState.get("")!]
        : DEFAULT_SURFACES.map(n => ({ name: n, color: parseHex(tokens[n]) }))

      // 文字色も状態ごとに集める
      const textByState = new Map<string, { name: string; alpha?: string }>()
      for (const m of text.matchAll(TEXT_RE)) {
        if (!tokens[m[2]] && !m[3]) continue
        textByState.set(stateOf(m[1]), { name: m[2], alpha: m[3] })
      }

      // 例外の申告は、かたまりの開始行かその直前の行にだけ書ける。
      // 窓を広げると隣の要素まで巻き込んで、本物のテキストを黙って除外してしまう。
      const optOut = OPT_OUT.exec(lines[i] ?? "") ?? OPT_OUT.exec(lines[i - 1] ?? "")

      // 茜の面を敷いて文字色を書いていない要素は、親から textMain を継承して 2.58:1 になる
      const strong = [...surfaceByState.values()].find(s => s.name === "accent" || s.name === "accentSoft")
      if (strong && textByState.size === 0) {
        if (optOut) exempt.push({ file, line: chunk.line, detail: `bg-${strong.name} — ${optOut[1]}` })
        else bareSurface.push({
          file, line: chunk.line,
          detail: `bg-${strong.name} に文字色の指定が無い（textMain を継承すると 2.58:1）`,
        })
      }

      // 実際に画面に並ぶ組み合わせだけを作る。
      //   通常状態 … 通常の文字 × 通常の地
      //   hover 等 … その状態の文字（無ければ通常の文字）× その状態の地
      // 「地だけ hover で変わり、文字はそのまま」を拾えるのが肝。
      type Pair = {
        text: { name: string; alpha?: string }
        surface: { name: string; color: Rgb }
        /** 文字にその状態の指定があるか。無ければ通常状態の文字が持ち越される */
        textState: string
        surfaceState: string
      }
      const pairs: Pair[] = []
      const baseText = textByState.get("")
      if (baseText) {
        for (const s of baseSurfaces) pairs.push({ text: baseText, surface: s, textState: "", surfaceState: "" })
      }
      for (const [state, surface] of surfaceByState) {
        if (state === "") continue
        const own = textByState.get(state)
        const t = own ?? baseText
        if (t) pairs.push({ text: t, surface, textState: own ? state : "", surfaceState: state })
      }
      // 地は変わらないが文字だけ変わる状態（hover:text-accent 等）
      for (const [state, t] of textByState) {
        if (state === "" || surfaceByState.has(state)) continue
        for (const s of baseSurfaces) pairs.push({ text: t, surface: s, textState: state, surfaceState: "" })
      }

      for (const { text: t, surface, textState, surfaceState } of pairs) {
        const hex = tokens[t.name]
        const fg = `${textState ? `${textState}:` : ""}text-${t.name}`

        if (t.alpha) {
          alphaText.push({ file, line: chunk.line, detail: `${fg}/${t.alpha}` })
          continue // 透過は 1. で落とすので比は測らない
        }
        if (!hex) continue // text-sm 等のサイズ指定・未定義トークンは対象外
        if (optOut) {
          exempt.push({ file, line: chunk.line, detail: `${fg} — ${optOut[1]}` })
          continue
        }

        const ratio = contrast(parseHex(hex), surface.color)
        const label = `${fg} on ${surfaceState ? `${surfaceState}:` : ""}${surface.name}`
        const prev = combos.get(label)
        combos.set(label, { ratio, count: (prev?.count ?? 0) + 1 })
        if (ratio < AA) {
          aaFail.push({ file, line: chunk.line, detail: `${label} (${hex}) = ${ratio.toFixed(2)}:1` })
        }
      }
    }
  }

  // ── 報告 ──
  const uniq = (rows: Finding[]) => {
    const seen = new Set<string>()
    return rows.filter(f => {
      const k = `${f.file}:${f.line}:${f.detail}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  console.log(`走査: ${files.length} ファイル（${SCAN_DIRS.join(", ")}）\n`)

  console.log("── 使用中の 文字色 × 地色 ──")
  for (const [key, { ratio, count }] of [...combos.entries()].sort((a, b) => a[1].ratio - b[1].ratio)) {
    console.log(`  ${ratio >= AA ? "OK  " : "NG  "}${ratio.toFixed(2).padStart(6)}:1  ${key}  (${count}箇所)`)
  }

  const exemptRows = uniq(exempt)
  if (exemptRows.length > 0) {
    console.log("\n── 申告済みの例外（地色が親要素・画像の上）──")
    for (const f of exemptRows) console.log(`  ${f.file}:${f.line}  ${f.detail}`)
  }

  const report = (title: string, rows: Finding[]) => {
    const r = uniq(rows)
    console.log(`\n── ${title} ──`)
    if (r.length === 0) console.log("  0件")
    else {
      for (const f of r) console.log(`  ${f.file}:${f.line}  ${f.detail}`)
      console.log(`  ${r.length}件`)
    }
    return r.length
  }

  const n1 = report("1. 透過による文字の階調", alphaText)
  const n2 = report("2. 茜の面に文字色の指定が無い要素", bareSurface)
  const n3 = report(`3. AA（${AA}:1）未達`, aaFail)

  if (n1 + n2 + n3 > 0) {
    console.error("\nコントラスト検査に失敗しました。")
    process.exit(EXIT.ERROR)
  }
  console.log("\nコントラスト検査を通過しました。")
}

main().catch(err => {
  console.error("check-contrast failed:", err)
  process.exit(EXIT.ERROR)
})
