# スライドとPDFの置き場所（リポジトリ／Vercel Blob）

> **設計のみ・未実装。** 12月定例（r8-2026-12-regular-4）のスライドを追加する直前に実装する。
> 前提は `feat/slides-r8-2026-09-regular-3` の変更（`build-slides-manifest.ts` と `slides.json`）が main に入っていること。
> 実装したら、このドキュメントと実装が食い違わないよう同じコミットで直すこと。

## 方針（2026-09-25 決定）

- **12月定例以降**の新しいスライド画像とPDFは Vercel Blob に置く
- 既存の `public/pdf/`（554MB）と `public/slides/`（163MB）は**据え置く**。移さない
- 履歴は書き換えない。目的は、リポジトリがこれ以上肥大しないようにすること（1会期あたり約12MB）
- 表示側では、リポジトリにあるセッションと Blob にあるセッションを区別しない

```
               リポジトリ（〜9月定例）                Vercel Blob（12月定例〜）
               public/slides/{id}/{dir}/page-NNN.jpg  {origin}/slides/{id}/{dir}/page-NNN.jpg
               public/pdf/{file}.pdf                  {origin}/pdf/{file}.pdf
                        │ build:slides-manifest が走査        │ slides:upload が記録（コミット）
                        ▼                                     ▼
                  （生成）                           data/slides-blob.json（正典）
                        └──────────── マージ ────────────────┘
                                         ▼
                            public/data/slides.json（生成物）
                                         ▼
                   lib/slides.ts → slideImages() / pdfUrl() → SessionDetail
```

**Blob 上のパスは `public/` と同じ構造にする**（`slides/{id}/{dir}/page-NNN.jpg`・`pdf/{file}`）。
リポジトリと Blob で違うのは先頭の origin だけになり、表示側は「origin + パス」の1つの規則で両方を扱える。

## 1. slides.json のスキーマ

セッションごとに `origin`（ベースURL）を持つ。リポジトリにあるセッションは `""` にする。

```json
{
  "r8-2026-09-regular-3": {
    "origin": "",
    "dirs": { "summary": 12 }
  },
  "r8-2026-12-regular-4": {
    "origin": "https://<store-id>.public.blob.vercel-storage.com",
    "dirs": { "day1": 14, "qna": 9 }
  }
}
```

- `dirs` の値はページ数。画像 URL は `{origin}/slides/{id}/{dir}/page-{001..N}.jpg` で組み立てる
  （`convertSlides` と同じく3桁ゼロ埋め・1始まり・連番）
- PDF の URL は `{origin}/pdf/{part.pdf}`。`session.yaml` の `pdf:` は今と同じくファイル名だけを書く
- 1つのセッションは、リポジトリか Blob のどちらか一方にだけ置く（パート単位では混在させない）

### 正典と生成物を分ける

`public/data/slides.json` は、今と同じく **build のたびに作り直す生成物**のままにする。
Blob 側の記録は、別のファイル `data/slides-blob.json` に分けてコミットする（正典。形式は上と同じで、origin が必ず空でない）。

分ける理由: リポジトリ分は `public/slides` を走査すれば毎回作り直せるが、Blob 分はビルド環境から走査できない。
1ファイルにまとめると、ビルドが自分の出力を入力として読み戻すことになり、ファイルを消したときに Blob 分が黙って失われる。
`public/data/` は生成物・直接編集禁止という既存の約束（CLAUDE.md）とも合う。

### `build-slides-manifest.ts` の変更

1. `public/slides/**` を走査して `{ origin: "", dirs: {...} }` を作る（今のロジックの出力形を変えるだけ）
2. `data/slides-blob.json` を読んでマージする
3. 検証。違反は exit 1 にする
   - 同じセッションIDが両方にある
   - `slides-blob.json` の origin が `https://` で始まらない、またはページ数が1未満
4. 警告（ビルドは止めない）: `session.yaml` のパートに `slidesDir` があるのに、slides.json に対応する行が無い（アップロード忘れの検知）

## 2. 表示側

`lib/slides.ts` を新しく作り、2つの関数に集約する。ページはこの2つだけを呼ぶ。

```ts
slideImages(sessionId: string, slidesDir: string): string[]   // origin + /slides/... の配列
pdfUrl(sessionId: string, pdf: string): string                // origin + /pdf/{pdf}
```

- `app/gikai/sessions/[id]/[partIndex]/page.tsx` の `getSlideImages()` と
  `` pdfPath: `/pdf/${part.pdf}` ``（現122行目）をこの2つに置き換える
- `SessionDetail.tsx` のスライドは `<Image unoptimized>` なので、外部 URL でも `next.config.ts` の `images.remotePatterns` は要らない
- OGP 画像はスライドを使っていないので影響しない

## 3. アップロードスクリプト `scripts/upload-slides.ts`

```bash
npm run slides:upload -- <sessionId> <slidesDir> <PDFのパス> [--force] [--dry-run]
# 例: npm run slides:upload -- r8-2026-12-regular-4 day1 ~/Downloads/r8-2026-12-regular-4_day1.pdf
```

1本で次を順に行う。作業ファイルはすべて一時ディレクトリに置き、**`public/` には何も書かない**（誤ってコミットする経路を作らない）。

| 順 | 処理 | 詳細 |
|---|---|---|
| 1 | 画像化 | 元の（圧縮前の）PDF から `pdftoppm -jpeg -r 150 -l 20`（`convertSlides.mjs` と同じ設定）。画質は元の PDF から取る |
| 2 | PDF の再圧縮 | `gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -dDetectDuplicateImages=true`。小さくならなければ元のファイルを使う。圧縮前後のサイズを表示する |
| 3 | アップロード | `@vercel/blob` の `put()`。`access: "public"`・`addRandomSuffix: false`（パスを固定）。パスは `slides/{id}/{dir}/page-NNN.jpg` と `pdf/{id}_{dir}.pdf` |
| 4 | 確認 | アップロードした全 URL に HEAD を投げて、200 と Content-Type を確かめる |
| 5 | 一覧の更新 | `data/slides-blob.json` の該当行を書き換える（キーは整列、`stableStringify` を使う） |
| 6 | 次の手順を表示 | `session.yaml` に書く `pdf:` と `slidesDir:` の2行を表示する。YAML は自動では書き換えない |

- **冪等**: 同じ `{id}/{dir}` が `slides-blob.json` にあればスキップする。`--force` で上書きする
- **トークン**: `BLOB_READ_WRITE_TOKEN` は `vercel env pull .env.local` で取る（`.env*` は gitignore 済み）
- `convertSlides.mjs` は既存セッションの作り直し用に残す。画像化の処理は両方で使う関数に切り出す

### 実装時に確認すること

- Vercel Blob の料金と無料枠（1会期12MB × 年6〜8会期なら小さいはずだが、数字を確かめる）
- `put()` で上書きするときのオプション（`allowOverwrite`）と CDN キャッシュの期限（`cacheControlMaxAge`）。
  上書き後も古い画像が配信される期間があるので、`--force` を使うときはその旨を表示する
- Blob ストアの作成とプロジェクトへの接続（Vercel ダッシュボード → Storage）

## 4. `tasks/add-session.md` の変更

今のステップ5（PDF を `public/pdf/` に移し、`slides:generate` を実行）を置き換える。

```
### ステップ5：PDFの再圧縮・アップロード・一覧の更新

1. npm run slides:upload -- {sessionId} {slidesDir} ~/Downloads/{sessionId}_{slidesDir}.pdf
   （再圧縮 → Blob にアップロード → data/slides-blob.json を更新、まで1本で行う）
2. 表示された2行（pdf: / slidesDir:）を content/sessions/{sessionId}/session.yaml の該当パートに書く
3. npm run build:slides-manifest && npm run dev で表示を確認
4. data/slides-blob.json と session.yaml をコミットする（public/ には何も増えていないこと）
```

## 実装の順番（12月定例の直前）

1. `slides.json` の形を変え、`lib/slides.ts` を作る。既存セッションが全部 `origin: ""` になり、表示が変わらないことを確認する
2. `data/slides-blob.json`（最初は `{}`）とマージ・検証処理
3. Blob ストアの作成と `upload-slides.ts`
4. 12月定例の1パートで通しで試し、`tasks/add-session.md` を書き換える
