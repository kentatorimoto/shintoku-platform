// tools/suggest-gikai-links.mjs
// giketsu_index.json の title からキーワードマッチで theme 候補を生成し
// data/gikai_links_suggested.csv に出力する。
//
// 使い方:
//   npm run suggest:links
//   → data/gikai_links_suggested.csv を確認して data/gikai_links.csv にコピペ追記
//   → npm run build:links を実行して public/data/gikai_links.json を再生成

import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const SESSIONS_PATH = join(ROOT, "public", "data", "giketsu_index.json")
const MASTER_CSV    = join(ROOT, "data", "gikai_links.csv")
const OUTPUT_CSV    = join(ROOT, "data", "gikai_links_suggested.csv")

// ── キーワードルール ────────────────────────────────────────────────

const THEME_KEYWORDS = {
  finance: [
    "予算", "決算", "補正", "財政", "基金", "起債", "債務",
    "交付税", "税", "歳入", "歳出", "入札",
  ],
  agriculture: [
    "農", "農業", "畑", "酪農", "畜産", "家畜", "飼料",
    "乳", "牛", "馬鈴薯", "甜菜", "ビート", "収穫", "農地",
  ],
  tourism: [
    "観光", "宿泊", "温泉", "道の駅", "キャンプ", "イベント",
    "誘客", "交流", "滞在", "プロモーション",
  ],
  health: [
    "福祉", "介護", "医療", "健診", "健康", "子育て",
    "保育", "教育", "学校", "給食",
  ],
  community: [
    "地域", "自治", "町内会", "防災", "消防", "移住",
    "定住", "空き家", "交通", "公共交通", "まちづくり",
  ],
}

// ── セッション読み込み ──────────────────────────────────────────────

let sessions
try {
  sessions = JSON.parse(readFileSync(SESSIONS_PATH, "utf-8"))
} catch (err) {
  console.error(`ERROR: ${SESSIONS_PATH} の読み込みに失敗しました`)
  console.error(`  ${err.message}`)
  process.exit(1)
}

if (!Array.isArray(sessions)) {
  console.error("ERROR: giketsu_index.json の形式が不正です（配列を期待）")
  process.exit(1)
}

// ── 既存マスター読み込み（重複チェック用） ─────────────────────────

/** @type {Set<string>} "eraLabel|caseType|num|ref" 形式（4列キー） */
const existing = new Set()

if (existsSync(MASTER_CSV)) {
  let masterRaw
  try {
    masterRaw = readFileSync(MASTER_CSV, "utf-8")
  } catch (err) {
    console.error(`ERROR: ${MASTER_CSV} の読み込みに失敗しました`)
    console.error(`  ${err.message}`)
    process.exit(1)
  }

  const effective = masterRaw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))

  if (effective.length > 0) {
    const cols = effective[0].split(",").map((c) => c.trim())
    const CI = cols.indexOf("caseType")
    const EI = cols.indexOf("eraLabel")
    const NI = cols.indexOf("num")
    const RI = cols.indexOf("ref")

    if (CI === -1 || EI === -1 || NI === -1 || RI === -1) {
      console.error(`ERROR: ${MASTER_CSV} のヘッダーが不正です（caseType,eraLabel,num,ref が必要）`)
      process.exit(1)
    }

    for (const line of effective.slice(1)) {
      const f = line.split(",").map((s) => s.trim())
      const ct = f[CI]; const era = f[EI]; const n = f[NI]
      const r  = (f[RI] ?? "").replace(/\s*#.*$/, "").trim()
      if (ct && era && n && r) existing.add(`${era}|${ct}|${n}|${r}`)
    }
  }
}

// ── 採用閾値 ・ score=1 許可リスト ──────────────────────────────────

/** theme ごとの最低採用スコア（finance は誤検知が多いため 2 に設定） */
const SCORE_THRESHOLD = {
  finance:     2,
  agriculture: 1,
  tourism:     1,
  health:      1,
  community:   1,
}

/**
 * score=1 のとき採用するには、matched キーワードがこの allowlist に含まれる必要がある。
 * finance は threshold=2 なので allowlist 不要。
 */
const SCORE1_ALLOWLIST = {
  agriculture: ["農業", "畜産", "酪農", "収穫", "農地", "家畜", "飼料"],
  tourism:     ["観光", "宿泊", "滞在", "温泉"],
  health:      ["医療", "介護", "福祉", "保育"],   // strong のみ（"健康" は weak へ）
  community:   ["定住", "移住", "防災", "消防", "町内会", "地域", "まちづくり"],
}

/**
 * health の score=1 弱キーワード。
 * このキーワードのみにマッチした場合は score=1 では採用しない（score>=2 のみ採用）。
 */
const SCORE1_WEAK_HEALTH = ["健康", "教育", "学校"]

// ── スコアリング ────────────────────────────────────────────────────

/** 同点時の優先順位（低インデックス = 高優先） */
const THEME_PRIORITY = ["finance", "health", "community", "agriculture", "tourism"]

/**
 * title に対して各 theme のキーワードマッチ数をスコア化し、全候補をスコア降順で返す。
 * 同点は THEME_PRIORITY で解決。呼び出し側で必要数だけ取り出す。
 * @param {string} title
 * @returns {{ themeId: string, score: number, matched: string[] }[]}
 */
function scoreThemes(title) {
  const results = []
  for (const [themeId, keywords] of Object.entries(THEME_KEYWORDS)) {
    const matched = keywords.filter((kw) => title.includes(kw))
    if (matched.length > 0) {
      results.push({ themeId, score: matched.length, matched })
    }
  }
  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return THEME_PRIORITY.indexOf(a.themeId) - THEME_PRIORITY.indexOf(b.themeId)
  })
}

/**
 * theme 候補を採用するかどうかを判定する。
 * - score >= SCORE_THRESHOLD[themeId] なら無条件採用
 * - score=1 の非 finance テーマは SCORE1_ALLOWLIST にヒットした場合のみ採用
 * @param {{ themeId: string, score: number, matched: string[] }} candidate
 * @returns {boolean}
 */
function isViable({ themeId, score, matched }) {
  const threshold = SCORE_THRESHOLD[themeId] ?? 2
  if (score >= threshold) return true
  // score=1 + allowlist チェック（finance は threshold=2 なのでここには来ない）
  if (score === 1) {
    const allowlist = SCORE1_ALLOWLIST[themeId] ?? []
    return matched.some((kw) => allowlist.includes(kw))
  }
  return false
}

// ── 走査 ───────────────────────────────────────────────────────────

/** @type {{ caseType: string, eraLabel: string, num: number, ref: string, score: number, matched: string[] }[]} */
const outputRows = []

/** unique key → handled（output or skipped）。eraLabel を含む 4列キー */
const seenKeys     = new Set()
/** unique quads that were skipped */
const skippedKeys  = new Set()
/** theme 別集計（採用件数） */
const themeCounts  = {}
/** score=1 で採用した件数（theme 別） */
const score1Counts = {}

let emptyTitleCount      = 0
let lowScoreCount        = 0
let allowlistExcluded    = 0
let healthWeakExcluded   = 0
/** weak キーワード別の除外数 { "健康": N, "教育": N, "学校": N } */
const healthWeakKwCounts = {}
/** 2テーマ出力した議案の (caseType|num) 記録 */
const multiThemeItems = new Set()

for (const session of sessions) {
  if (!Array.isArray(session.items)) continue
  const { eraLabel } = session

  for (const item of session.items) {
    const { caseType, num, title } = item

    if (!title || !title.trim()) {
      emptyTitleCount++
      continue
    }

    const allCandidates = scoreThemes(title)
    if (allCandidates.length === 0) continue

    // 採用判定
    // score >= 2 → 無条件採用（finance も threshold=2 なのでここで通る）
    // score === 1 → finance(threshold=2)は不採用、非finance は allowlist を通す
    const viable = []
    for (const c of allCandidates) {
      if (c.score >= 2) {
        viable.push(c)
      } else if (c.score === 1) {
        const threshold = SCORE_THRESHOLD[c.themeId] ?? 2
        if (threshold >= 2) continue  // finance: score=1 は閾値未満 → スキップ
        // 非 finance: allowlist チェック
        const allowlist = SCORE1_ALLOWLIST[c.themeId] ?? []
        if (c.matched.some((kw) => allowlist.includes(kw))) {
          viable.push(c)
        } else {
          if (c.themeId === "health") {
            const weakHit = c.matched.filter((kw) => SCORE1_WEAK_HEALTH.includes(kw))
            if (weakHit.length > 0) {
              healthWeakExcluded++
              for (const kw of weakHit) {
                healthWeakKwCounts[kw] = (healthWeakKwCounts[kw] ?? 0) + 1
              }
            }
          }
          allowlistExcluded++
        }
      }
    }

    if (viable.length === 0) {
      lowScoreCount++
      continue
    }

    // 上位1件、同点なら上位2件まで選ぶ
    const winners = [viable[0]]
    if (viable.length > 1 && viable[1].score === viable[0].score) {
      winners.push(viable[1])
    }

    // 2テーマ出力した議案を記録（同一 eraLabel|caseType|num は1回だけ）
    const itemKey = `${eraLabel}|${caseType}|${num}`
    if (winners.length === 2 && !multiThemeItems.has(itemKey)) {
      multiThemeItems.add(itemKey)
    }

    for (const { themeId, score, matched } of winners) {
      const ref = `theme:${themeId}`
      const key = `${eraLabel}|${caseType}|${num}|${ref}`

      // 同一 key は 1 回だけ処理（同一セッション内重複を防ぐ）
      if (seenKeys.has(key)) continue
      seenKeys.add(key)

      // マスターに既存 → スキップ
      if (existing.has(key)) {
        skippedKeys.add(key)
        continue
      }

      outputRows.push({ caseType, eraLabel, num, ref, score, matched })
      themeCounts[themeId] = (themeCounts[themeId] ?? 0) + 1
      if (score === 1) {
        score1Counts[themeId] = (score1Counts[themeId] ?? 0) + 1
      }
    }
  }
}

// eraLabel 昇順 → num 昇順 → ref 昇順でソートして読みやすくする
outputRows.sort((a, b) =>
  a.eraLabel.localeCompare(b.eraLabel, "ja") || a.num - b.num || a.ref.localeCompare(b.ref)
)

// ── 出力 ───────────────────────────────────────────────────────────

const csvLines = [
  "# 自動提案ファイル（毎回上書き生成）",
  "# 内容を確認して npm run merge:links で data/gikai_links.csv に取り込んでください。",
  "# score と matched はコメント参考値（CSV 取り込み時は無視されます）",
  "caseType,eraLabel,num,ref",
  ...outputRows.map(
    ({ caseType, eraLabel, num, ref, score, matched }) =>
      `${caseType},${eraLabel},${num},${ref}  # score:${score} matched:[${matched.join("/")}]`
  ),
]

try {
  writeFileSync(OUTPUT_CSV, csvLines.join("\n") + "\n", "utf-8")
} catch (err) {
  console.error(`ERROR: ${OUTPUT_CSV} の書き込みに失敗しました`)
  console.error(`  ${err.message}`)
  process.exit(1)
}

// ── サマリー ───────────────────────────────────────────────────────

console.log(`✓ ${OUTPUT_CSV}`)
console.log(`  採用(合計):       ${outputRows.length}件`)
console.log(`  除外(閾値未満):   ${lowScoreCount}件`)
console.log(`  除外(allowlist):  ${allowlistExcluded}件`)
console.log(`  複数テーマ出力:   ${multiThemeItems.size}件（2テーマ）`)
console.log(`  スキップ(重複):   ${skippedKeys.size}件`)
if (emptyTitleCount > 0) {
  console.log(`  title空スキップ: ${emptyTitleCount}件`)
}
console.log("  theme 別内訳（採用件数 / うちscore=1）:")
for (const [id, count] of Object.entries(themeCounts).sort(([, a], [, b]) => b - a)) {
  const s1 = score1Counts[id] ?? 0
  const s1str = s1 > 0 ? ` (score=1: ${s1}件)` : ""
  console.log(`    ${id.padEnd(12)}: ${count}件${s1str}`)
}
const healthTotal    = themeCounts.health ?? 0
const healthS1Strong = score1Counts.health ?? 0
const healthS2Plus   = healthTotal - healthS1Strong
const healthBefore   = healthTotal + healthWeakExcluded
console.log("  health 内訳:")
console.log(`    score=1 strong採用: ${healthS1Strong}件  (医療/介護/福祉/保育)`)
console.log(`    score=1 weak除外:   ${healthWeakExcluded}件` +
  (Object.keys(healthWeakKwCounts).length > 0
    ? `  (${Object.entries(healthWeakKwCounts).map(([k, v]) => `${k}:${v}`).join(" / ")})`
    : ""))
console.log(`    score>=2 採用:      ${healthS2Plus}件`)
console.log(`    採用 before→after:  ${healthBefore}件 → ${healthTotal}件  (-${healthWeakExcluded}件)`)
console.log("")
console.log("次のステップ:")
console.log("  1. data/gikai_links_suggested.csv を確認")
console.log("  2. 適切な行を data/gikai_links.csv に追記")
console.log("  3. npm run build:links を実行")
