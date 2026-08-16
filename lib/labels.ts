// UI表示ラベルの一元管理（翻訳層）。
//
// データ層（content/ のMD・schema・public/data のJSON）の語彙は正式名称のまま変えない。
// 変えるのは「読者が最初に目にする言葉」だけ。正式名称は formal として小さく併記し、
// 生活語と正式語の対応が画面上で常に辿れる状態を保つ。
//
// コピーの調整はこのファイル1つで完結させること。コンポーネント側に文字列を戻さない。

export interface UiLabel {
  /** 画面で主役になる生活語 */
  text: string
  /** 併記する正式名称。省略時は併記なし */
  formal?: string
}

export const LABELS = {
  /** ヘッダーのワードマーク脇。正式名称「新得町議会記録集」はフッターに残す */
  siteTagline: "町のことが、どう決まっているか。",
  siteFormalName: "新得町議会記録集",

  /** 本会議・議案審議セクション（HonkaigiSection） */
  honkaigi: {
    text:   "この会議で決まったこと",
    formal: "議案審議",
  },

  /** 一般質問セクション（QnaSection） */
  qna: {
    text:   "議員が聞いたこと、町の答え",
    formal: "一般質問",
  },

  /** 予算・決算特別委員会のパート。生活語化は未確定のため現行文言を維持する */
  qnaCommittee: {
    text: "予算審査 — 項目ごとの質疑",
  },

  /** 委員会付託 */
  committeeReferral: {
    text:   "委員会でくわしく審査することになったもの",
    formal: "委員会付託",
  },

  /** 行政報告（現時点でUI未実装。実装時にここを参照する） */
  administrativeReport: {
    text:   "町からの報告",
    formal: "行政報告",
  },

  /** 継続論点（トップの索引・/process） */
  continuingIssues: {
    text:   "つづいている話",
    formal: "継続論点",
  },

  /** 動画アーカイブ。正式名称の併記なし */
  video: {
    text: "会議の動画",
  },

  /** スライド */
  slides: {
    text: "スライド",
  },

  /** 要点カード */
  cards: {
    text: "この会議の要点",
  },

  /** カードがあるセッションで、旧スライドを折りたたむときの見出し */
  legacySlides: {
    text: "過去のスライド",
  },
} as const satisfies Record<string, string | UiLabel>

/** カードの種別ラベル（スキーマ §11.1 の kind）。カード左上に小さく出る。 */
export const CARD_KIND_LABELS: Record<string, string> = {
  headline: "この会期の要点",
  number:   "数字で見る",
  decision: "決まったこと",
  question: "議員が聞いたこと",
  next:     "これから",
}

/**
 * 一般質問セクションのラベル。予算・決算特別委員会のパートは speaker_role が
 * 「委員」になるため、見出しと導線で同じ判定を共有する。
 */
export function qnaLabel(speakerRole: string | undefined): UiLabel {
  return speakerRole?.includes("委員") ? LABELS.qnaCommittee : LABELS.qna
}

/** セッション詳細のページ内アンカー。summary 直下の導線から飛ぶ先。 */
export const ANCHORS = {
  honkaigi: "giketsu",
  qna:      "qna",
} as const
