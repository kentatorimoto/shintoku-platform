# 新規セッション追加タスク

YouTubeのURLを渡すだけで、構造化データ抽出からデプロイまで半自動で完了する。

## 使い方
```
セッションを追加して
https://www.youtube.com/watch?v=XXXXXXX　令和８年３月２日　定例第１回　初日
https://www.youtube.com/watch?v=YYYYYYY　令和８年３月１２日　定例第１回　一般質問
```

PDFがある場合は ~/Downloads/ に置いておく。URLのみでも追加可能。

---

## 手順

### ステップ1：セッションIDの決定

命名規則：r{元号}-{西暦年}-{月2桁}-{会議種別}
- 定例会：regular-{回数}
- 臨時会：rinji-{回数}
- 特別委員会：tokubetsu / kessan-tokubetsu / yosan-tokubetsu

例：r8-2026-03-regular-1

---

### ステップ2：NotebookLMでテキスト構造化抽出

各パートのYouTube URLに対して以下を実行：

1. NotebookLMにノートブックを作成（タイトル：officialTitle + パートラベル）
2. YouTube URLをソースとして追加（wait=true, wait_timeout=180）
3. 会議種別に応じて以下のクエリを投げる：

**一般質問パートの場合：**
```
この議会の一般質問について、質問者ごとに以下を構造化して全て抽出してください。
①質問テーマ ②主な質問内容 ③行政の回答 ④結論・継続課題
発言者名、具体的な数値、固有名詞も省略せずに含めてください。
```

**本会議・議案審議パートの場合：**
```
この会議の審議内容について、議案ごとに以下を構造化して全て抽出してください。
①議案名・番号 ②議案の内容 ③主な質疑内容 ④採決結果
発言者名、具体的な数値、固有名詞も省略せずに含めてください。
```

**予算委員会・決算委員会パートの場合：**
```
この委員会の審査内容について、審査項目ごとに以下を構造化して全て抽出してください。
①審査項目・科目 ②主な質疑内容 ③行政の説明・回答 ④結論
発言者名、具体的な数値、固有名詞も省略せずに含めてください。
```

4. 抽出結果をもとに `public/data/qna/{sessionId}.json`（一般質問）または
   `public/data/qna/{sessionId}_day{n}.json`（本会議）を生成

スキーマはCLAUDE.mdの「Part Data」セクションを参照。

---

### ステップ3：gikai_sessions.json に追加

PDFの内容またはNotebookLMの抽出結果をもとに以下を生成：

- narrativeTitle：会議の本質を一言で表すタイトル
- summary.issues：論点（1〜2文・80字以内）
- summary.conflicts：争点（なければ空欄）
- summary.nextActions：次アクション（1〜2文・80字以内）
- tags：CLAUDE.mdのタグルールに従う

日付降順になるよう適切な位置に挿入。

---

### ステップ4：PDFのスライド化（手動作業の指示）

以下をユーザーに表示して作業を依頼する：
```
【手動作業が必要です】

NotebookLMでスライドPDFを生成してください：
1. 以下のノートブックを開く：
   {NotebookLMのノートブックURL}

2. 「ノートブックガイド」からスライドを生成

3. 生成されたPDFを以下のファイル名で保存：
   ~/Downloads/{sessionId}_{slidesDir}.pdf

完了したら「PDF保存しました」と入力してください。
```

ユーザーの返答を待ってからステップ5に進む。

---

### ステップ5：PDF配置とスライド画像生成

ユーザーがPDF保存を完了したら：

1. PDFを移動：
   ~/Downloads/{sessionId}_{slidesDir}.pdf
   → public/pdf/{sessionId}_{slidesDir}.pdf

2. スライド画像生成：
   npm run slides:generate {sessionId} {slidesDir}

URLのみでPDFなしの場合はこのステップをスキップ。

---

### ステップ6：確認

- /gikai/sessions でセッションが表示されるか確認
- /gikai/sessions/{sessionId}/0 で詳細ページを確認
- QNA・議案データが正しく表示されるか確認

---

### ステップ7：コミット・プッシュ
```bash
git add -A
git commit -m "feat: {officialTitle}追加"
git push origin main
```
