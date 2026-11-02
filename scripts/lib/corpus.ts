// 会議録と広報の全文（Layer 0）は非公開リポジトリ kentatorimoto/shintoku-corpus に置く。
// 公開リポジトリには入れない。手元・Actions とも .corpus/ に clone して読み書きする（CORPUS_DIR で変えられる）。
//
//   git clone git@github.com:kentatorimoto/shintoku-corpus.git .corpus

import fs from "fs"
import path from "path"

export const CORPUS_DIR = path.resolve(process.env.CORPUS_DIR ?? path.join(process.cwd(), ".corpus"))

/** corpus 内のパス。corpus が無ければ、空のまま進めずに止める */
export function corpusPath(...parts: string[]): string {
  if (!fs.existsSync(path.join(CORPUS_DIR, ".git")) && !process.env.CORPUS_DIR) {
    throw new Error(`全文の corpus が無い: ${CORPUS_DIR}（git clone git@github.com:kentatorimoto/shintoku-corpus.git .corpus）`)
  }
  if (!fs.existsSync(CORPUS_DIR)) throw new Error(`CORPUS_DIR が無い: ${CORPUS_DIR}`)
  return path.join(CORPUS_DIR, ...parts)
}
