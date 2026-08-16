# SHINTOKU ATLAS — コンテンツ正典スキーマ v1.2

> このドキュメントは、セッション記録の**正典（canonical source）をMarkdownに置く**ための仕様。
> リポジトリの `docs/content-schema.md` に配置し、抽出プロンプト・変換スクリプト・レビュー基準はすべてここから導出する。
>
> **v1.1 変更点**: §5に行政報告（administrative_reports）の本文構造を追加／§3に不透明フィールド退避（topics_index）を追加／§6にgray-matterのYAML日付自動変換対策を明記。
>
> **v1.2 変更点**（既存18セッションの実データ検証を反映）: §2に `sortDate` を追加／§4に見出しの厳密パース規則と空値の扱いを追加／§5の `bill_numbers` 区切りとメタ行の省略規則を明記／§6にJSON出力時のデフォルト値規則を追加／§10としてタグ規則を実データに合わせて再定義。
>
> **v1.3 変更点**: §11として `cards.yaml`（要点カード）を追加。レビュー済みMDの派生物であり、正典そのものではない。kind は `decision`（議案の採決結果）と `report`（行政報告由来）を分ける。

---

## 0. 設計原則

1. **層の一方向性** — データは必ず `字幕 → MD → JSON` の順に流れる。逆流禁止。修正はMDに対してのみ行い、JSONは常に再生成する。
2. **JSON完全互換** — 既存 `QnaData` / `HonkaigiData` の全フィールドがMDから機械的に導出できる。UIコード（`SessionDetail.tsx` 等）は一切変更しない。
3. **人間可読性** — MDは変換用の中間形式ではなく、それ自体が「読める議事記録」であること。GitHub上でそのまま読める。
4. **diff可能性** — 1発言＝1セクションの構造にし、固有名詞の訂正が最小diffで現れるようにする。
5. **決定的パース** — 見出しレベルとラベルを固定し、曖昧さのないパースを保証する。AIの出力ゆらぎはバリデーションで弾く。

---

## 1. ディレクトリ構成

```
content/
  sessions/
    r8-2026-06-regular-2/
      session.yaml              # セッションメタ（gikai_sessions.json の1要素分）
      day1.md                   # パート別MD（正典）
      day2.md
      transcripts/
        day1.txt                # Layer 0: 字幕生データ（再処理用・変更禁止）
        day2.txt
public/
  data/                         # ここは全て生成物（ビルド時に上書き）
    gikai_sessions.json
    qna/{sessionId}_day{n}.json
```

命名規則は既存踏襲：`day{n}`（本会議の日程）／`part{n}`（パート分割）／単一なら `session.md`。
`getPartData()` の探索順と同じ対応：`day{n}.md → {sessionId}_day{n}.json`。

> **transcripts/ は不可侵。** AI抽出の再実行・将来の全文検索・監査のための Layer 0。
> 誤字があってもここは直さない（直すのはMD側）。

---

## 2. session.yaml（セッションメタ）

`gikai_sessions.json` の1要素に対応。ビルド時に全セッション分を集約して同JSONを生成する。

```yaml
id: r8-2026-06-regular-2
officialTitle: 令和8年第2回新得町議会定例会
narrativeTitle: 温浴延期と3.6億の投資、町の現在地
date: "2026-06-03"
sortDate: "2026-06-03"   # 任意。省略時は date にフォールバック（§2.1）
tags: [定例会, 財政, 観光, インフラ]   # タグ規則は §10
summary:
  issues: 温浴施設整備の延期と大型投資の扱い
  conflicts: 延期判断の妥当性をめぐる質疑
  nextActions: 最終日での議決・QNA追加
parts:
  - label: 初日（6/3）
    youtube: "https://www.youtube.com/watch?v=XXXX"
    pdf: r8-2026-06-regular-2_part1.pdf
    slidesDir: day1        # スライド継続する場合のみ。廃止時は削除
```

`narrativeTitle` / `summary` / `parts[].youtube` / `parts[].pdf` / `parts[].slidesDir` は省略可。省略した場合、生成JSONでもキーごと出力しない。

### 2.1 sortDate — 並び順の基準日

`gikai_sessions.json` の配列順が、そのまま UI の表示順になる（`/gikai/sessions`・`/process/timeline`・`GlobalSearch` のいずれも日付ソートを行わず配列順を使う）。

`build-data.ts` は **`sortDate ?? date` の降順、同値なら `id` の昇順**で全セッションを並べる。

- `date` は「セッションを代表する日」（多くは最終日）であり、**会期が複数日にわたる場合、実時間順とずれる**。
- `sortDate` は「並び順の基準日。通常は会期初日」を明示するための任意キー。

実例: `r8-2026-03-regular-1` は会期 3/2〜3/18 の定例会で `date: "2026-03-18"`。その会期中の 3/16 に `r8-2026-03-yosan-tokubetsu`（予算特別委員会）が開かれている。`date` だけで降順に並べると予算特別委員会が定例会の後ろに回ってしまうため、定例会側に `sortDate: "2026-03-02"`（会期初日）を与えて実時間順を保つ。

> 逆変換（`json-to-md.ts`）は、`date` だけのソートで既存配列順を再現できないセッションにのみ `sortDate` を書き出す。

---

## 3. パートMD — 共通フロントマター

```yaml
---
session_id: r8-2026-06-regular-2
part_index: 0                  # 0始まり。day1.md → 0
part_type: honkaigi            # "honkaigi" | "qna"
session_date: "2026-06-03"
source_url: "https://www.youtube.com/watch?v=XXXX"
extracted_by: claude-sonnet-4-20250514   # 抽出モデルの記録（監査用）
extracted_at: "2026-07-10"
reviewed: false                # 人間レビュー済みフラグ。PRマージ時にtrueへ
---
```

既存JSONとの差分：`extracted_by / extracted_at / reviewed` は監査用の追加フィールド。JSON生成時には出力しない（内部管理用）。

**不透明フィールドの退避（`_passthrough`）**

既存JSONの `topics_index` はファイルによって3つの異なるスキーマが混在しており（正規化は往復テストgreen後の別タスク）、本文構造への対応付けを行わない。frontmatterの `_passthrough:` キー配下にYAMLとして**丸ごと退避**し、JSON生成時に無加工で復元する。

```yaml
_passthrough:
  topics_index:
    - title: 一般会計補正予算
      speaker: 新井一郎
```

`_passthrough` 配下は変換スクリプトが一切解釈しない契約とする。今後も「UIが読むがMD本文に対応先のないフィールド」はここに退避する。

> 既存JSONでは一般質問の `part_type` は未指定だが、MDでは `qna` を明示する。
> JSON生成時に `qna` の場合はフィールド自体を省略し、既存挙動と互換にする。

---

## 4. 本文構造 — qna（一般質問）

見出しレベルとラベルを**固定**。この構造がそのまま `QnaItem[]` になる。

```markdown
# 一般質問

## 新井一郎（議員）— 観光振興の体制について
<!-- ## {speaker_name}（{speaker_role}）— {topic_title} -->

tags: 観光, 財政

### 質問
- 観光協会の体制について町の認識を問う
- 満足度25%という数字への対応
<!-- 箇条書き1項目 = question_points 1要素 -->

### 答弁
まずは現体制で外からの誘客強化と運用改善を優先する考えが示された。
<!-- 最初の段落 = answer_summary -->

- 組織改編より運用改善を優先
- 危機感は共有する
<!-- 箇条書き = answer_points -->

### 結論
組織改編の是非は評価軸を整理した上で改めて議論することとなった。
<!-- 段落全体 = conclusion -->

### 継続課題
- 観光組織のあり方の評価軸づくり
<!-- 箇条書き = continuing_issues。なければセクション自体を省略 -->

### 言及
entities: 観光協会, 新得駅前地域交流センター
numbers: 満足度25%, 事業費10億5,323万円
<!-- mentioned_entities / mentioned_numbers。なければ省略 -->
```

**パース規則（qna）**

| MD要素 | JSONフィールド |
|---|---|
| `## 名前（役割）— タイトル` | `speaker_name` / `speaker_role` / `topic_title` |
| 見出し直下の `tags:` 行 | `topic_tags` |
| `### 質問` の箇条書き | `question_points` |
| `### 答弁` の最初の段落 | `answer_summary` |
| `### 答弁` の箇条書き | `answer_points` |
| `### 結論` の段落 | `conclusion` |
| `### 継続課題` の箇条書き | `continuing_issues` |
| `### 言及` の `entities:` / `numbers:` | `mentioned_entities` / `mentioned_numbers` |

### 4.1 見出しの厳密パース規則

`## {speaker_name}（{speaker_role}）— {topic_title}` は、次の正規表現で解釈する。

```
/^(?<name>.*)（(?<role>[^（）]*)）\s*—\s*(?<topic>.+)$/
```

`name` を**貪欲**に取ることで、区切り文字として使う `（` `）` `—` が `speaker_name` / `speaker_role` 自体に現れても壊れない。実データに次の2件が存在する。

| 見出し | speaker_name | speaker_role | topic_title |
|---|---|---|---|
| `## （提案説明のみ）（—）— 議案第16号：職員給与条例の一部改正` | `（提案説明のみ）` | `—` | `議案第16号：職員給与条例の一部改正` |
| `## 採決結果（）— 議案第20号ほかの採決` | `採決結果` | `（空文字）` | `議案第20号ほかの採決` |

- `speaker_role` が空文字でも `（）` は**必ず書く**（省略すると区切りが消えて名前とタイトルの境界が失われる）。
- `topic_title` に ` — ` を含めてはならない（貪欲な `name` が食い込むため）。逆変換スクリプトは検出時に警告する。

### 4.2 空値とセクション省略

MD側は空のセクションを書かない。JSON生成時は**必ず全11フィールドを出力**し、欠けたセクションはデフォルト値で埋める（配列なら `[]`、文字列なら `""`）。UIが `.map()` で回すため `undefined` を出してはならない。

| 状態 | MD | JSON |
|---|---|---|
| `topic_tags` が空 | `tags:` 行を省略 | `[]` |
| `question_points` が空 | `### 質問` ごと省略 | `[]` |
| `answer_summary` が空・`answer_points` あり | `### 答弁` に箇条書きのみ | `""` / 配列 |
| `answer_summary` も `answer_points` も空 | `### 答弁` ごと省略 | `""` / `[]` |
| `conclusion` が空 | `### 結論` ごと省略 | `""` |
| `continuing_issues` が空 | `### 継続課題` ごと省略 | `[]` |
| `mentioned_*` が両方空 | `### 言及` ごと省略 | `[]` / `[]` |
| `mentioned_*` の片方だけ空 | 該当行のみ省略 | `[]` |

---

## 5. 本文構造 — honkaigi（本会議・議案）

```markdown
# 議案審議

## 議案第3号 — 新得町国民健康保険条例の一部改正
<!-- ## {bill_number} — {bill_title} -->

tags: 医療, 財政
proposer: 町長
result: 可決
result_detail: 挙手全員
referred_to_committee: false

### 概要
条例改正の内容。保険料率の改定を含む。
<!-- summary -->

### 質疑
**新井一郎**
Q: 改定の根拠となる試算について
A: 直近3年の医療費推移に基づく試算であると説明された
<!-- 質疑1件 = 太字の質問者名 + Q:行 + A:行。複数可。質疑なしならセクション省略 -->

## 議案第4号 — …
（同構造の繰り返し）

# 行政報告

## 新得駅前地域交流センターの利用状況について
令和8年4月末時点の利用者数等が報告された。
<!-- administrative_reports 1件 = ## {title} + 直下の段落 = content -->
<!-- 複数段落の場合は空行区切りのまま content に "\n\n" 結合で格納 -->
<!-- 報告なしならこの見出しごと省略 -->

# 委員会付託

- 議案第16号〜第26号 → 予算特別委員会
  note: 予算関連議案一括付託
<!-- committee_referrals。なければこの見出しごと省略 -->
```

**パース規則（honkaigi）**

| MD要素 | JSONフィールド |
|---|---|
| `## 議案番号 — タイトル` | `bill_number` / `bill_title` |
| メタ行 `tags: / proposer: / result: / result_detail: / referred_to_committee:` | 同名フィールド |
| `### 概要` の段落 | `summary` |
| `### 質疑` の `**名前**` + `Q:` + `A:` の組 | `questions[]`（questioner/content/answer） |
| `# 行政報告` の `## タイトル` + 段落 | `administrative_reports[]`（title/content） |
| `# 委員会付託` の箇条書き | `committee_referrals`（`→` 前が bill_numbers、後が committee、`note:` 行が note） |

> `administrative_reports` は現状UIで未表示だが、将来のUI拡張候補として本文構造に含める（frontmatter退避にしない）。
> `HonkaigiData` 型には `administrative_reports?: { title: string; content: string }[]` として追加する。

### 5.1 見出しの厳密パース規則

`## {bill_number} — {bill_title}` は次の正規表現で解釈する。

```
/^(?<number>.+?)\s*—\s*(?<title>.+)$/
```

`number` を**非貪欲**に取り、**最初の ` — ` を境界**として残り全部を `title` に倒す（`bill_title` に `—` が含まれても壊れない）。`bill_number` に ` — ` を含めてはならない。

### 5.2 メタ行と空値

- メタ行の順序は `tags: / proposer: / result: / result_detail: / referred_to_committee:` に固定。
- `referred_to_committee:` は**必須**（`true` / `false`）。それ以外のメタ行は値が空なら行ごと省略し、JSON生成時に `[]` / `""` で埋める。
- `bill_tags` が空、`proposer` が空文字の議案は実在する（採決のみの項目など）。
- `### 質疑` の1件は「`**質問者**` / `Q: ` / `A: `」の3行を1段落として書く。質疑が無ければセクションごと省略し、JSONでは `questions: []`。

### 5.3 委員会付託の記法

```markdown
# 委員会付託

- 議案第16号, 議案第17号 → 予算特別委員会
  note: 予算関連議案一括付託
```

- `→` の**前**をカンマ区切りで分割して `bill_numbers`（配列）、**後**を `committee`。
- `note:` 行は任意。無ければ `note: ""`。
- `bill_numbers` の各要素に `,` および `→` を含めてはならない（`〜` は可: `議案第16号〜第26号`）。
- `committee_referrals` が空でも honkaigi の JSON では `committee_referrals: []` を必ず出力する（既存JSON互換）。一方 `administrative_reports` は**空ならキーごと出力しない**。

---

## 6. 変換スクリプト（scripts/build-data.ts）

```
実行:  npx tsx scripts/build-data.ts
入力:  content/sessions/**/*.md, session.yaml
出力:  public/data/gikai_sessions.json
       public/data/qna/{sessionId}_day{n}.json ほか
```

処理契約：

1. **バリデーション優先** — 見出し構造・必須フィールド・タグ規則（§10）に違反したら**JSONを出力せずエラー終了**。壊れたデータがサイトに出ることを構造的に防ぐ。
2. **完全上書き** — `public/data/` 配下の生成対象は毎回作り直す。手編集の余地を残さない。
3. **決定的出力** — 同じMDからは常にバイト同一のJSONを生成（キー順固定・整形固定）。生成物のdiffがMDのdiffとだけ対応する。
4. 実装は `gray-matter`（frontmatter）＋ `remark` / `mdast`（本文AST）。正規表現パースはメタ行（`tags:` 等）のみに限定。
   本文テキストの取り出しは AST ノードの `position.start.offset` / `end.offset` による**原文スライス**で行う。`mdast-util-to-string` 相当でテキスト化すると `**` や `_` などの記法文字が失われるため。
5. **YAML日付の自動変換対策（必須）** — gray-matter は内蔵の js-yaml 3.x で frontmatter をパースし、無クォートの `2026-06-03` を JS の Date に自動変換してしまう。`engines` オプションで自前の js-yaml（v5系）を渡し、`CORE_SCHEMA`（timestamp 型を持たない）でパースして日付の自動変換を無効化すること。`session.yaml` の読み込みも同様。「日付は必ずクォート」の記法規約は維持するが、防御はパーサ側で保証する（人間の手編集は規約を破りうる前提で設計する）。
6. **JSON出力のキー順と省略規則** — `stableStringify()` が下表のキー順で出力する。「省略可」以外のキーは、値が空でも必ず出力する。

| ファイル | キー順 | 省略可 |
|---|---|---|
| `gikai_sessions.json` の要素 | `id, officialTitle, narrativeTitle, date, summary, parts, tags` | `narrativeTitle`, `summary` |
| `parts[]` | `label, youtube, pdf, slidesDir` | `youtube`, `pdf`, `slidesDir` |
| qna JSON | `session_id, part_index, session_date, source_url, items, topics_index` | `topics_index` |
| honkaigi JSON | `session_id, part_index, session_date, part_type, source_url, items, committee_referrals, administrative_reports` | `administrative_reports` |
| `QnaItem` | `speaker_name, speaker_role, topic_title, topic_tags, question_points, answer_summary, answer_points, conclusion, continuing_issues, mentioned_entities, mentioned_numbers` | なし |
| `BillItem` | `bill_number, bill_title, bill_tags, summary, proposer, questions, result, result_detail, referred_to_committee` | なし |
| `BillQuestion` | `questioner, content, answer` | なし |
| `CommitteeReferral` | `bill_numbers, committee, note` | なし |
| `AdministrativeReport` | `title, content` | なし |

`sortDate` は並び順の決定にのみ使い、`gikai_sessions.json` には出力しない。

npm scripts への追加：

```json
"scripts": {
  "build:data": "tsx scripts/build-data.ts",
  "build": "npm run build:data && next build"
}
```

これで **Vercelビルド時に必ずMDから再生成**され、「JSONを直接編集する」経路が消える。

---

## 7. 運用フロー（新パイプラインとの接続）

```
1. RSS監視で新着動画検知（watch-council.yml / cron 09:00 JST）→ GitHub Issue
2. 人間: セッションIDと種別（qna / honkaigi）を決めて npm run add-session を起動
3. 字幕取得 → content/sessions/{id}/transcripts/ に保存（Layer 0・不可侵）
4. Claude APIで字幕 → MD抽出（このスキーマの §3+§4 / §3+§5 を出力仕様として渡す）
   → build:data のバリデータで検証 → 落ちたらエラーをAPIに返して自己修正（最大2回）
5. 自動PR作成（MD + session.yaml + 【要確認】マークの一覧）
6. 人間レビュー：MDだけを読む・直す（reviewed: true に変更）
7. マージ → Vercelビルド → build:data がJSON生成 → デプロイ
```

レビュー観点はMDに集約される：固有名詞（議員名・施設名は `scripts/prompts/glossary.md` と照合）、数値、タグ規則。JSONは見なくてよい。

**frontmatter は `extract-md.ts` が決定的に生成し、AIには本文だけを書かせる。** 日付・`part_index`・`_passthrough` をAIに触らせないため。`extracted_by` には実際のモデルIDが入る。

字幕から確信をもって読み取れない固有名詞・数値は、AIが創作せず `【要確認: 聞こえたまま】` とマークする。PR本文に集約されるのでレビューの起点になる。

---

## 8. 移行計画（既存17〜19セッション）

- **Phase 1**: `build-data.ts` を先に作り、既存JSONから**逆変換でMDを機械生成**（json-to-md、使い捨てスクリプト）。往復変換（MD→JSON）で既存JSONとバイト一致することを確認 → 正典の切替が無リスクで完了
- **Phase 2**: `public/data/` を生成物化（git管理から外すか、生成物としてコミット継続かは選択。Vercelビルドで生成するなら .gitignore 推奨）
- **Phase 3**: 品質を上げたいセッションから順に、字幕からの**再抽出**でMDを置き換え（任意・漸進的）

> Phase 1 の往復一致テストが移行の安全弁。これが通れば「MDが正典」への切替は既存サイトに一切影響しない。

## 9. 決めごと（レビュー時の判断基準）

- MDの本文は**事実の再配置のみ**。評価語（良い/悪い/すべき）は書かない — サイト本体と同じ規律
- 答弁・結論は「〜が示された」「〜と説明された」「〜として記録されている」の抑制的動詞で統一
- AI抽出のままの箇所は `reviewed: false` を維持。人が確認して初めて true
- 固有名詞の確認先：新得町公式サイトの議員名簿・施設一覧
- 自然人の住所は地区名まで（番地以下は記載しない）。生年月日は記載せず年齢のみ可。法人・事業者の所在地はそのまま記載してよい。

---

## 10. タグ規則（session.yaml の `tags`）

CLAUDE.md は「種別タグをちょうど1つ」と記していたが、実データでは**会議の種別**と**扱う議案の種別**が併用されている（例: `[定例会, 補正予算, …]`）。両者を別カテゴリとして扱う。

| カテゴリ | 値 | 個数 |
|---|---|---|
| 会議種別 | `定例会` `臨時会` `特別委員会` | ちょうど1 |
| 議案種別 | `当初予算` `補正予算` `決算` | 0 または 1 |
| 属性 | `争点あり` `修正可決あり` | 任意（客観的事実フラグ） |
| テーマ | 下記 + 未知タグ | 最大6 |

既知テーマ: `インフラ` `農業` `観光` `宿泊税` `教育` `文化` `子育て` `財政` `医療` `物価高騰対策` `総合計画` `エネルギー` `人口政策`

`validateTags()` の判定:

- **エラー（exit 1）**: 会議種別が0個または2個以上／議案種別が2個以上／テーマが7個以上
- **警告のみ**: 既知テーマ一覧にないテーマタグ（将来の追加を塞がないため）。現在 `住民訴訟` `林業` が該当

> タグの並び順は `session.yaml` の記述順をそのまま保持する（カテゴリ順への正規化はしない）。

---

## 11. cards.yaml（要点カード）

`content/sessions/{id}/cards.yaml`。旧NotebookLMスライドの後継で、**レビュー済みMDの派生物**。
正典はあくまでMD本文であり、カードはそれを読者向けに要約した表示層にすぎない。

```
生成:  npm run cards:generate -- {sessionId}
入力:  content/sessions/{id}/*.md（全パートが reviewed: true であること）
出力:  content/sessions/{id}/cards.yaml
変換:  build:data → public/data/cards/{sessionId}.json
```

```yaml
generated_by: claude-sonnet-4-6      # 生成モデル（監査用）
generated_at: "2026-08-16"
reviewed: false                      # カード自体の人間レビュー済みフラグ
cards:
  - kind: headline                   # headline | number | decision | report | question | next
    title: 温浴施設の開業がまた延期に  # 30字以内
    detail: 資材調達の遅れが理由。既存の温浴施設は営業を延長する。   # 120字以内
    link: /gikai/sessions/r8-2026-06-regular-2/0
  - kind: number
    value: "3.6億円"                 # kind が number / next のときは必須。1つだけ
    title: 補正予算はインフラと福祉へ
    detail: 一般会計補正予算（第2号）の総額。道路・除雪と子育て支援に配分される。
```

### 11.1 kind の使い分け

| kind | 何を1枚にするか | `value` |
|---|---|---|
| `headline` | この会期でいちばん大きな出来事。**必ず1枚目**（OGP画像はここから作る） | 任意 |
| `number` | 1つの数字が語ること（金額・人数・年度） | **必須** |
| `decision` | 決まったこと。**議案の採決結果に限る** | 任意 |
| `report` | 行政報告に由来する事実（採決を経ていないもの） | 任意 |
| `question` | 議員が投げかけた問いと、町の答え | 任意 |
| `next` | これから起きること・次の節目（日付・時期） | **必須** |

### 11.2 検証規則（`validateCards()`）

- **エラー（exit 1）**: `cards` が空／9枚以上／1枚目が `headline` でない／未知の `kind`／`title`・`detail` が空／
  `number`・`next` で `value` が無い／`link` が `/gikai/sessions/{sessionId}/{パート番号}` 形式でない、
  またはパート番号が存在しない／未知のキー
- **警告のみ**: 5枚未満／`title` が30字超／`detail` が120字超

`reviewed: false` でもビルドは通す。Preview で見てから直す運用のため、表示自体は止めない。

### 11.3 内容の規律

- **MDに書かれている事実のみ。** 数値はMDから転記し、創作しない
- 評価語・煽り表現を書かない。「〜が決まった」「〜が延期に」等の事実文で止める
- 「新」「刷新」「大幅」等の程度・新規性を示す修飾語は、MD本文にその語がある場合のみ使う
- 読者は議会用語を知らない一般町民。中学生が読める語彙で書く
- `【要確認: 〜】` が付いた箇所はカードにしない（未確認の情報を要約の主役にしない）

### 11.4 キー順（`stableStringify`）

| ファイル | キー順 | 省略可 |
|---|---|---|
| `public/data/cards/{id}.json` | `session_id, generated_by, generated_at, reviewed, cards` | なし |
| `cards[]` | `kind, title, value, detail, link` | `value`, `link` |
