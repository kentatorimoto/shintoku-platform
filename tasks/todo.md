# todo — 更新パイプラインの自動化（feat/auto-ingest）

watch-council は新着を検知して Issue を立てるだけで、add-session は人間が手で起動していた。
9/14〜9/18 の5本（#15 #16 #17 #18 #25）が未取り込みで溜まったのを受け、Issue → PR までを
GitHub Actions 上で走らせる。**人間に残す判断はレビューだけにする。**

## 方針（確認済み）

1. #17 の日付はタイトルどおり 2026-09-16。規則の一貫性を優先し、ずれはPRレビューで拾う
2. `date` / `sortDate` は「最終日」ラベルのパートを足したときだけ自動更新する
3. 決算特別委員会の年度は元号年−1、予算特別委員会は元号年（表に両方書く）
4. PR本文に推定の根拠（どの規則が効いたか）を機械的に書き出す

## やること

- [x] `scripts/lib/session-id-rules.ts` — 表1（会議名→ID）・表2（パート名→part/type）と推定関数
- [x] `scripts/lib/ingest-state.ts` — 字幕待ち・諦め・取り込み済みの状態（`data/watch/ingest-state.json`）
- [x] `scripts/lib/telegram.ts` — 通知3種（PR作成／字幕待ち保留／推定不能で停止）
- [x] `scripts/auto-ingest.ts` — Issue取得 → 推定 → 字幕 → 抽出 → 検証 → ブランチ/PR → 通知
- [x] `scripts/add-session.ts` — scaffold / narrativeTitle を export して再利用（振る舞いは変えない）
- [x] `scripts/config.ts` — `TRANSCRIPT_RETRY_DAYS`（諦めるまでの日数）
- [x] `.github/workflows/auto-ingest.yml` — workflow_call / schedule / workflow_dispatch
- [x] `.github/workflows/watch-council.yml` — 新着を立てたら auto-ingest を呼ぶ
- [x] `docs/auto-ingest.md` — 対応表と運用（迷ったらこれが正）
- [x] CLAUDE.md — コマンドとデータフローに反映
- [x] `npm run auto-ingest -- --dry-run` で #15〜#25 の割り当てを確認
- [ ] Secrets を登録してもらい、実地テスト（溜まった5本）← 次はここ

## 設計の要点

- **順序**: 字幕取得 → session.yaml 追記 → 抽出。逆にすると、字幕待ちで止まったときに
  parts だけ増えて次回の partIndex がずれる
- **失敗時の復元**: パートの処理に失敗したら session.yaml を処理前の内容に戻し、MDを消す。
  transcripts/ は残す（Layer 0・再取得が高い）
- **既存パートは上書きしない**: partIndex は常に `parts.length`。埋まっていたら停止
- **冪等**: 動画URLが既存 session.yaml にあればスキップ。同じ Issue を何度流しても増えない
- **cards:generate は走らせない**（レビュー後の工程）。生成物は必ず `reviewed: false`

## レビュー

### 確認したこと

- `npm run auto-ingest -- --dry-run` の出力が、事前に合意した割り当て表と一致
  （#15 part1 / #16 part2 / #17 day2 / #18 day3 / #25 day4）
- 対応表を実在タイトル11本で総当たり: 既存 `r8-2026-03-regular-1` `r8-2026-09-regular-3` と矛盾なし。
  表に無い会議（基本構想審査特別委員会）・会議とパートの不整合・日付なしは、いずれも推定せず停止
- `applyFinalDayDates` を複製した session.yaml で実行し、narrativeTitle のコメントが残ること、
  `sortDate` が `date` の直後に入ること、キー順がスキーマ §2 どおりになることを確認
- `npm run build:data` の出力が変わらないこと（`public/data/` に差分なし）
- `npm run lint` / `tsc --noEmit` で新規ファイルに指摘なし

### 実地テスト前の確認

6本（#15 #16 #17 #18 #25 #27）すべて字幕を取得できることを確認した（最長は #15 の
33,533字・115分で、抽出の上限 150,000字に対して余裕がある）。exit 3 に当たる動画は無い。

### 途中で見つけて直したこと

- **`igK2MirgtK8`（#25 の動画）が `known-videos.json` に入っていない。**
  watch-council の push が他ワークフローと競合して弾かれると、既知リストが保存されず
  翌日に同じ動画で重複Issueが立つ。commit 前に `git pull --rebase` するよう直した。
  auto-ingest 側にも重複Issueの検知（コメントして取り込まない）を入れた
- RSSの `published` は、配信枠の作成時刻 → 実際の配信終了後に開催日へ更新される。
  #15 は当初 9/11 と出ていたが現在は 9/14T15:24。**5本ともタイトルの日付が正しい**と裏が取れた
  （#17 も 9/16T16:34 で、タイトルの 9/16 が正しい）
- 表2に「（パート名なし）」を追加。`令和8年7月6日 臨時第3回` のように臨時会は
  パート名が付かないことがあり、そのままでは毎回停止していた

### 残っている判断

- Secrets（`ANTHROPIC_API_KEY` / `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`）の登録
- リポジトリ設定「Allow GitHub Actions to create and approve pull requests」の有効化
- （解決）`令和8年7月6日 臨時第3回`（`fzEjguY0KsM`）は #27 を立てて取り込み対象にした。
  既知リストに入っている動画を拾い直せるよう `watch:council --video` を足してある


## 公開待ちの補完（2026-09-24 時点）

- **令和8年定例第3回の議決結果PDF（`r8tei3kekka.pdf`）が未公開。** 公開されたら
  `npm run scrape:giketsu` を回し、`r8-2026-09-regular-3/day4.md` の
  意見案第9号・第10号のタイトルを正式名称に補完する（いまは番号と趣旨のみ）
- **令和7年度の決算資料が未公開**（決算認定は9/18可決）。公開されたら
  `r8-2026-09-kessan-tokubetsu` の削除した2つの数値
  （委託料の令和4年額・農地環境整備事業補助金の決算額）を補える
- 公営住宅等長寿命化計画（令和8年3月版）は種別内訳を載せていない。
  令和17年度末の公営住宅戸数を補うには計画の付表か施設課の資料が要る
- `r8-2026-06-regular-2/day2.md` の「田中副町長」は誤認識の疑い（広報では畑中 栄和）。
  別タスクで再確認する
