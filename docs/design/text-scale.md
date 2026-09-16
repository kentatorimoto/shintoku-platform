# 文字の階調

配色そのものの正は `docs/design/atlas-hybrid-warm.html`、値の正は `app/globals.css` の `@theme`。
この文書は**どの階調をどこに使うか**だけを決める。

`lib/labels.ts` が UI の語彙を一箇所で決めているのと同じ考え方で、
階調も一箇所で決める。各ページで `/70`・`/50` と不透明度を書いて階調を作らない。

## 1. 3段だけ

| トークン | 値 | 紙 (`paper`) | カード地 (`ink`) | 使いどころ |
|---|---|---|---|---|
| `textMain` | `#23241c` | 12.66:1 | 11.70:1 | 本文、見出し、ページタイトル、議案名、質問・回答の本体 |
| `textSub` | `#4a4b40` | 7.16:1 | 6.62:1 | リード文、説明文、カードの要約、`pageDesc`、`backLink`、`chip` |
| `textMuted` | `#5f6052` | 5.17:1 | 4.78:1 | ラベル、日付、件数、タグ、注記、キャプション、`tag`、placeholder |

最弱の `textMuted` でも、紙とカード地の両方で AA（4.5:1）を満たす。
**4段目は作らない。** 紙の上で AA を満たす輝度の上限は `textSub` の実色から RGB 1段しかなく、
そこに置いた色は `textSub` と見分けがつかない。

## 2. 透過で階調を作らない

```
NG  text-textSub/70   text-textSub/50   text-textMain/80   text-accent/70
OK  text-textSub      text-textMuted    text-textMain      text-accent
```

理由は2つ。

- **実測できない。** 同じ `text-textSub/60` が紙の上とカード地の上で違う色になる。
  カードの中に入れ子のカードがあればさらに変わる。設計時に確かめた比が保証されない
- **AA に届かない。** `textSub` は紙の上で 4.58:1（当時）しか余裕が無く、
  70% をかけた時点で 2.69:1 まで落ちる。`text-xs` の補助テキストなので
  「大きい文字は 3:1 でよい」の例外も使えない

## 3. 弱い階調が要るときは、サイズと余白で作る

色をもう一段薄くする方向では解決しない。順に試す。

1. **font-size** — `text-sm` の本体に対して `text-xs` / `text-[11px]` のラベル
2. **余白** — `mt-0.5` や `pl-3` で従属関係を示す
3. **罫線** — `border-l border-line pl-3` で引用・回答であることを示す

例（`SessionDetail.tsx` の議案アコーディオン）。`dt` と `dd` は同じ淡墨だが、
サイズと横並びのレイアウトで役割が読み分けられる。

```tsx
<dt className="text-xs text-textMuted w-16">概要</dt>
<dd className="text-sm text-textSub leading-relaxed">{item.summary}</dd>
```

## 4. 茜（`accent`）は薄めない

茜は「最新・現在地・ホバー」だけに使う。薄めるとその規律が空洞化するので、
`text-accent/70` のような指定は作らない。弱くしたいなら茜をやめて `textSub` か `textMuted` にする。

**薄い茜地の上に茜の文字を載せない。** `bg-accent/20` の上の `text-accent` は
カード地で 3.44:1 にしかならず、`accentSoft` に落としても 4.00:1 で届かない。
選択状態は `globals.css` の `.chipActive` と同じ形にする——
**地は中立の `bg-hover`、現在地は茜の文字と罫線で示す**。

```
NG  bg-accent/15 text-accent border-accent/40
OK  bg-hover     text-accent border-accent
```

茜地に文字を載せるときは実色の `bg-accent` と `text-onAccent`（4.92:1）を使う。

## 5. `text-base` は文字サイズ

紙の色トークンは `base` ではなく **`paper`** という名前にしてある。
`--color-base` を定義すると Tailwind が `.text-base { color: … }` を生成し、
本来の文字サイズ 1rem の `text-base` を潰してしまうため。
`bg-paper` / `text-paper` が紙の色、`text-base` は文字サイズ。

## 6. 検査

```bash
npm run check:contrast
```

`app/` と `components/` を走査して2つを見る。`npm run build` からも呼ばれる。

1. 透過による文字の階調（`text-textSub/70` 等）が0件であること
2. 使用中の「文字色 × 地色」がすべて AA（4.5:1）を満たすこと
   半透明の地（`bg-accent/20` 等）は紙の上に合成してから実測する

値はスクリプトに書かれていない。`app/globals.css` の `@theme` を読んで検査するので、
トークンを足しても検査側は書き換え不要。

地色が親要素にある場合や、文字でない装飾は行単位の走査で追えない。
その場合だけソースに理由を書いて申告する。

```tsx
{/* contrast-ok: 親の bg-black/55 の上に載る非テキストのアイコン */}
<svg className="w-7 h-7 text-white" …>
```
