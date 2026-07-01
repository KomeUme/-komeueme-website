# お知らせ更新仕様

## 正本

- お知らせデータはルート直下の `news-data.js` で管理する
- トップページのカードと `news.html?id=...` の詳細ページは同じデータから自動描画する
- 個別のお知らせHTMLは作成しない

## 追加方法

1. DM画像を使う場合は `assets/news/` に配置する
2. `news-data.js` の `newsItems` に1件追加する
3. `id` は半角英数字とハイフンで重複しない値にする
4. `published: true` にする
5. `node scripts/validate-news-data.js` を実行する
6. 公開前にトップ表示と `news.html?id=<id>` を日本語・英語の両方で確認する

## 表示制御

- `displayFrom` より前はトップへ表示しない
- `displayUntil` を過ぎたお知らせはトップから外す
- 表示期間内で最も新しい1件だけをトップへ表示する
- トップから外れた後も詳細URLは閲覧できる
- 公開対象がない場合は「現在お知らせはございません。」を表示する
- `image` は任意。未指定の場合は文章だけのレイアウトにする

## データ項目

- 必須: `id`, `published`, `title`
- 推奨: `displayFrom`, `displayUntil`, `date`, `place`, `lead`, `period`, `venue`, `hours`, `body`
- 画像: `image`, `imageAlt`
- 英語: 各項目名に `_en` を付ける。例: `title_en`, `body_en`
