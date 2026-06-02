# portfolio_rules.md

## ページ構造の共通規約
- 共通ヘッダー: `brand + nav + dropdown(版画/デジタル/漫画)`
- 共通メイン: `intro` セクションを先頭に置く（TOPのみ `top-hero` あり）
- 共通フッター直前: `site-mini-contact`（SNS/Contact）を配置
- 下位カテゴリを持つカテゴリページでは、`intro` 内に下位カテゴリへの控えめな導線を置く
- デジタルは親ページを持たず、ヘッダーとTOP導線は `digital-illustration.html` を既定リンク先にする

## ギャラリー構造
- 作品一覧は `section[data-gallery]` を使用し、`app.js` でカードを自動生成する
- 1作品カードは次の順で固定する
1. `.work-image-link`（画像リンク）
2. `.caption-title`
3. `.caption-meta`（制作年/技法/サイズ）
4. `.caption-text`
- 版画・漫画系は `gallery-grid`（2列）、デジタルは `gallery`（masonry列）を使う

## 並び順と分類ルール
- 既定は `arrangeBySimilarity`（縦横比・面積近似）
- `data-sort="recent"` は年降順、`data-sort="random"` はランダム
- 版画は技法文字列で木版/銅版を判定、漫画は `subcategory` と文言で四コマ判定

## 作品画像の選定ルール（新規追加時）
- 1枚目画像は「余白のない画面のみ」の中から最適な1枚を採用する
- 2枚目画像は「余白あり」の候補から、画面の歪み・傾きが最も少ない1枚を採用する
- 3枚目以降を含む複数枚構成でも、上記2条件を優先して並び順を決める
- 複数枚ある場合は、各画像について余白量・歪み・傾きを比較し、条件適合度の高い順に採用する

## 画像表示ルール
- 画像は `object-fit: contain`、歪ませない
- 通常カードの画像箱は `min-height: 440px`、TOP selected は `572px` 固定運用
- 画像向きは読み込み後に `is-portrait/is-landscape` を付与して見た目を調整する

## 変更時の必須確認
- `data-gallery` 属性を壊していない
- 画像/キャプションDOMのクラス名を変更していない
- `app.js` の自動生成前提（class/data属性）との整合が取れている
- 作品画像の1枚目/2枚目が選定ルールを満たしている
