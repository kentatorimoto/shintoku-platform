# scripts/migration/ — 凍結

**移行時の証明ツール。役目を終えたので凍結する。改変も実行も不要。**

`public/data/*.json` を正典としていた頃のデータを `content/sessions/**` のMarkdownへ移すために書いた使い捨てスクリプト。`json-to-md.ts` で逆変換し、`roundtrip-test.ts` で「MD → JSON の正変換が既存データと構造一致する」ことを全18セッションで証明した（PR #1）。その一致をもって正典を `content/` に切り替えた。

以後、新しいセッションは `content/` のMDが唯一の入力であり、`json-to-md.ts` を再実行する理由はない（既存JSONを上書きして逆流させることになる）。

| ファイル | 役割 |
|---|---|
| `json-to-md.ts` | 既存JSON → `content/sessions/**`（逆変換・使い捨て） |
| `roundtrip-test.ts` | JSON → MD → JSON の構造一致テスト（移行の安全弁） |

恒久的なビルドは `scripts/build-data.ts`（`npm run build:data`）。仕様は `docs/content-schema.md`。
