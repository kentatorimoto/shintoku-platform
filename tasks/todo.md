# 読者ファースト化（並び替え／翻訳層／要点カード）

指示書: 「一般の町民が面白く読める → そこから議会の意思決定に興味を持つ」順に設計し直す。
データ層（`content/`・schema・パイプライン）の正式語彙は変えない。変えるのは **UIの語彙と順序**、
および **要点カードという新しい表示層**。

PR構成: Phase A+B = `feat/reader-first`（UIのみ）／ Phase C = `feat/session-cards`（別PR）。

---

## Phase A: セッションページの並び替え（逆ピラミッド）

- [x] `SessionDetail.tsx` の並びを summary →（カード/スライド）→ 動画 → 議案審議/一般質問 に変更
- [x] 各セクションの内部構造は変更なし（並び替えのみ）
- [x] 議案審議に `#giketsu`・一般質問に `#qna` アンカー（`scroll-mt-20` でヘッダー分を逃がす）
- [x] summary カード直下にページ内リンク（「この会議で決まったこと 36件 ↓」）を追加
- [x] スライドなしパートはセクション非表示（PR #6 の実装のまま）

## Phase B: 翻訳層（UIラベルの生活語化）

- [x] `lib/labels.ts` 新設。UI表示ラベルを一元管理（`{ text, formal }`）
- [x] ヘッダーサブ → 「町のことが、どう決まっているか。」／正式名称はフッターのコピーライト行に残す
- [x] 議案審議 → 「この会議で決まったこと」（正式併記あり）
- [x] 一般質問 → 「議員が聞いたこと、町の答え」（正式併記あり）
- [x] 委員会付託 → 「委員会でくわしく審査することになったもの」（正式併記あり）
- [x] 継続論点 → 「つづいている話」（トップの索引・`/process` の索引見出し）
- [x] 動画アーカイブ → 「会議の動画」（正式併記なし）
- [x] 行政報告 → 「町からの報告」を `labels.ts` に定義（UI未実装のため定義のみ）
- [x] narrativeTitle・タグ・採決結果チップは変更しない

### 保留（Kenta の判断待ち）

- **SHEET番号・座標などの英字ラベルは今回維持**（デザイン署名のため）。試用判定の際に翻訳層と合わせて再評価する
- 予算・決算特別委員会パートの見出し「予算審査 — 項目ごとの質疑」は現行文言のまま `labels.ts` へ移送。
  生活語化するかは未定（`LABELS.qnaCommittee`）
- QnaItem 詳細の `dt` ラベル（質問／行政の回答／結論／継続課題）は現行維持。
  「継続課題」は `/process` の「継続論点」とは別語なので、指示書の対応表の対象外と判断した
- `GlobalSearch` のカテゴリチップ（セッション／一般質問／議決）は短いラベルなので正式語のまま

## Phase C: 要点カード（スライドの後継）＋ OGP

- [ ] `scripts/generate-cards.ts`（`npm run cards:generate -- <sessionId>`）
      - 全パートMDが `reviewed: true` でなければ exit 1
      - `scripts/prompts/cards.md` にプロンプト（5〜8枚・MDの事実のみ・評価語禁止・中学生の語彙）
- [ ] `build-data.ts` に cards.yaml のバリデーション＋ `public/data/cards/{id}.json` 変換
- [ ] `components/SessionCards.tsx`（summary 直下・横スワイプ・`1/6` 表示）
- [ ] 旧スライドは、カードがあるセッションでは「過去のスライド」として折りたたみ
- [ ] `app/gikai/sessions/[id]/opengraph-image.tsx`（next/og）＋ 汎用OG画像
- [ ] `tasks/add-session.md` に「reviewed:true → cards:generate → 確認 → reviewed:true」を追記
- [ ] `r8-2026-06-regular-2` でカード生成し、cards.yaml をPRに含める（トーンの基準作り）
- [ ] 過去セッションへのカード遡及生成はスコープ外

---

## レビュー

### Phase A+B（`feat/reader-first`）

- `npm run build` 成功（80ページSSG、`public/data/` の生成物に差分なし＝データ層は無変更）
- `npx tsc --noEmit` クリーン。`npm run lint` の既存6エラー（`scripts/test-scraper.ts` 等）以外に新規指摘なし
- 変更ファイル: `lib/labels.ts`(new), `SessionDetail.tsx`, `[partIndex]/page.tsx`,
  `components/Header.tsx`, `components/Footer.tsx`, `app/page.tsx`, `app/process/page.tsx`

#### 設計判断

- **セクション見出しは `{ text, formal }` の2行組**（生活語15px太字＋正式名称11.5px）。
  生活語だけに置き換えると正確性が落ちるため、対応が常に画面上で辿れる形にした
- **`qnaLabel(speakerRole)` を `labels.ts` に置いた。** 見出し（SessionDetail）と導線（page.tsx）で
  同じ分岐を二重に書くと、予算委員会パートでラベルがずれるため
- **導線は summary カードの内側に入れた。** 独立カードにすると読者の視線が summary から一度切れる
