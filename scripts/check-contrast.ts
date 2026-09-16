/**
 * 文字色のコントラスト検査。回帰防止用。
 *
 * 2つのことを見る。
 *   1. 透過による文字の階調（text-textSub/70 等）が1件も無いこと
 *   2. 使われている「文字色 × 地色」の組み合わせがすべて WCAG AA（4.5:1）を満たすこと
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
 * 申告済みの例外。
 *
 * 地色が親要素にある（または画像の上に載る）場合、行単位の走査では追えない。
 * そういう箇所はソース側に `contrast-ok: 理由` と書いて除外する。理由を書かせるのは、
 * 黙って消せる抜け穴にしないため。文字ではない装飾・アイコンにも使う（AA は文字の規定）。
 */
const OPT_OUT = /contrast-ok:\s*(.+?)\s*(?:\*\/|$)/

/**
 * 文字色に地色が明示されていないときに想定する面。
 * .card が bg-ink なので、同じユーティリティが紙にもカードにも載る。両方で通す必要がある。
 */
const DEFAULT_SURFACES = ["paper", "ink"]

/** 地色ユーティリティ（bg-xxx / bg-xxx/NN）を面の実色に解決する。 */
function resolveSurface(
  token: string,
  alpha: number | null,
  tokens: Record<string, string>,
): Rgb | null {
  const hex = tokens[token]
  if (!hex) return null
  const color = parseHex(hex)
  if (alpha === null) return color
  // 半透明の地は紙の上に合成する（カード地より紙の方が明るく、文字には不利な側）
  return composite(color, parseHex(tokens.paper), alpha / 100)
}

async function main() {
  const tokens = readTokens()
  const files = SCAN_DIRS.flatMap(d => walk(join(ROOT, d)))

  const alphaText: Finding[] = []
  const aaFail: Finding[] = []
  const exempt: Finding[] = []
  const combos = new Map<string, { ratio: number; count: number }>()

  // className 文字列を行単位で見る。bg と text が同じ行に並ぶのがこの配色の書き癖。
  const TEXT_RE = /(?:^|[\s"'`{])(?:(?:hover|focus|group-hover|active|placeholder|md|sm|lg|dark):)*text-([A-Za-z][A-Za-z0-9]*)(?:\/(\d+))?(?=[\s"'`}]|$)/g
  const BG_RE = /(?:^|[\s"'`{])(?:(?:hover|focus|group-hover|active|md|sm|lg|dark):)*bg-([A-Za-z][A-Za-z0-9]*)(?:\/(\d+))?(?=[\s"'`}]|$)/g

  for (const abs of files) {
    const file = relative(ROOT, abs)
    const lines = readFileSync(abs, "utf8").split("\n")

    lines.forEach((raw, i) => {
      // CSS/JS のコメント行は検査しない（説明文に例示が書かれるため）
      const line = raw.replace(/\/\*.*?\*\//g, "").replace(/^\s*(\/\/|\*|\/\*).*$/, "")
      if (!line.includes("text-")) return

      // この行で使える地色。無ければ紙とカード地の両方を想定する。
      const surfaces: { name: string; color: Rgb }[] = []
      for (const m of line.matchAll(BG_RE)) {
        const c = resolveSurface(m[1], m[2] ? Number(m[2]) : null, tokens)
        if (c) surfaces.push({ name: m[2] ? `${m[1]}/${m[2]}` : m[1], color: c })
      }
      if (surfaces.length === 0) {
        for (const n of DEFAULT_SURFACES) surfaces.push({ name: n, color: parseHex(tokens[n]) })
      }

      // 例外の申告は同じ行か直前の行に書く
      const optOut = OPT_OUT.exec(raw) ?? OPT_OUT.exec(lines[i - 1] ?? "")

      for (const m of line.matchAll(TEXT_RE)) {
        const [, name, alpha] = m
        const hex = tokens[name]
        if (!hex) continue // text-sm 等のサイズ指定・未定義トークンは対象外

        if (optOut && !alpha) {
          exempt.push({ file, line: i + 1, detail: `text-${name} — ${optOut[1]}` })
          continue
        }

        if (alpha) {
          alphaText.push({ file, line: i + 1, detail: `text-${name}/${alpha}` })
          continue // 透過は 1. で落とすので比は測らない
        }

        for (const s of surfaces) {
          const ratio = contrast(parseHex(hex), s.color)
          const key = `text-${name} on ${s.name}`
          const prev = combos.get(key)
          combos.set(key, { ratio, count: (prev?.count ?? 0) + 1 })
          if (ratio < AA) {
            aaFail.push({
              file,
              line: i + 1,
              detail: `text-${name} (${hex}) on ${s.name} = ${ratio.toFixed(2)}:1`,
            })
          }
        }
      }
    })
  }

  // ── 報告 ──
  console.log(`走査: ${files.length} ファイル（${SCAN_DIRS.join(", ")}）\n`)

  console.log("── 使用中の 文字色 × 地色 ──")
  const rows = [...combos.entries()].sort((a, b) => a[1].ratio - b[1].ratio)
  for (const [key, { ratio, count }] of rows) {
    const mark = ratio >= AA ? "OK  " : "NG  "
    console.log(`  ${mark}${ratio.toFixed(2).padStart(6)}:1  ${key}  (${count}箇所)`)
  }

  if (exempt.length > 0) {
    console.log("\n── 申告済みの例外（地色が親要素・画像の上）──")
    for (const f of exempt) console.log(`  ${f.file}:${f.line}  ${f.detail}`)
  }

  console.log(`\n── 1. 透過による文字の階調 ──`)
  if (alphaText.length === 0) {
    console.log("  0件")
  } else {
    for (const f of alphaText) console.log(`  ${f.file}:${f.line}  ${f.detail}`)
    console.log(`  ${alphaText.length}件`)
  }

  console.log(`\n── 2. AA（${AA}:1）未達 ──`)
  if (aaFail.length === 0) {
    console.log("  0件")
  } else {
    const seen = new Set<string>()
    for (const f of aaFail) {
      const k = `${f.file}:${f.line}:${f.detail}`
      if (seen.has(k)) continue
      seen.add(k)
      console.log(`  ${f.file}:${f.line}  ${f.detail}`)
    }
    console.log(`  ${seen.size}件`)
  }

  if (alphaText.length > 0 || aaFail.length > 0) {
    console.error("\nコントラスト検査に失敗しました。")
    process.exit(EXIT.ERROR)
  }
  console.log("\nコントラスト検査を通過しました。")
}

main().catch(err => {
  console.error("check-contrast failed:", err)
  process.exit(EXIT.ERROR)
})
