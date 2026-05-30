# captions_style.md

## キャプションの情報順（固定）
1. タイトル（`.caption-title`）
2. メタ3項目（制作年・技法・サイズ）
3. 本文（`.caption-text`）

## 文字スタイル
- `.caption`: `font-size: 16px; line-height: 1.55; color: var(--soft)`
- `.caption-title`: `15px`、サンセリフ、本文より濃い色
- `.caption-meta`: `14px`、2列（ラベル `68px` + 値）
- `.caption-text`: `16px`、明朝、`white-space: pre-line`
- モバイル（<=760px）では title `14px` / meta `12px` / text `15px`

## 長文の折りたたみ
- 長文時は `.caption-text.is-collapsed` を適用し、4行で省略表示
- トグル文言は i18n キーを使う
- `caption_more`: 続きを読む / Read more
- `caption_less`: 閉じる / Close

## 文言ルール
- キャプション本文は事実ベースで記述し、曖昧な推測表現を避ける
- 同一情報（年/技法/サイズ）は省略せず、欠損時は `—` を表示する
- 日本語と英語で意味差が出ないよう、キー単位で対訳を揃える
