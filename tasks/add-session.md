# 新規セッション追加タスク

新しい議会PDFが追加されたときの手順テンプレート。

## 使い方

以下の形式で指示するだけでOK：

```
セッションを追加して
令和８年３月２日　定例第１回　初日_Shintoku Town Blueprint.pdf
https://www.youtube.com/watch?v=XXXXXXX
```

複数パートの場合：

```
セッションを追加して
令和８年３月２日　定例第１回　初日_xxx.pdf　https://www.youtube.com/watch?v=AAA
令和８年３月１３日　定例第１回　一般質問_xxx.pdf　https://www.youtube.com/watch?v=BBB
令和８年３月１９日　定例第１回　最終日_xxx.pdf　https://www.youtube.com/watch?v=CCC
```

ファイルは ~/Downloads/ にあると仮定して処理する。
URLが不明な場合は省略可。

## 手順

### 1. セッションIDの決定
命名規則：r{元号}-{西暦年}-{月2桁}-{会議種別}
- 定例会：regular-{回数}
- 臨時会：rinji-{回数}
- 特別委員会：tokubetsu または kessan-tokubetsu / yosan-tokubetsu

例：r8-2026-03-regular-1

### 2. PDFの移動とリネーム
~/Downloads/{元のファイル名}.pdf
→ public/pdf/{sessionId}_part{n}.pdf

複数パートがある場合は part1, part2... と連番。

### 3. スライド画像生成
npm run slides:generate を実行

### 4. PDFを読み込みデータ生成
PDFの内容をもとに以下を生成：
- narrativeTitle：会議の本質を一言で表すタイトル
- summary.issues：論点（何が議題になったか）
- summary.conflicts：争点（何が対立したか・なければ空欄）
- summary.nextActions：次アクション（何を確認すべきか）

issues・conflicts・nextActions それぞれ1〜2文・80字以内を目安。
最重要点のみに絞る。箇条書きにしない。

### 5. gikai_sessions.json に追加
既存セッションの形式に従って追加。
日付降順になるよう適切な位置に挿入。

タグ付けルール（CLAUDE.md参照）：
- 会議種別は必ず1つ
- テーマは実際に議論された内容に限る（最大5〜6個）
- 争点あり・修正可決ありは客観的事実として付ける

### 6. 確認
- ブラウザで /gikai/sessions を開いて表示確認
- 個別セッションページ（/gikai/sessions/{sessionId}）を確認
- タグが正しく付いているか確認

### 7. コミット・プッシュ
git add -A
git commit -m "feat: {officialTitle}セッション追加"
git push origin main
