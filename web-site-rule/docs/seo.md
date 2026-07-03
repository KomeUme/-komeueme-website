# seo.md

## 現状の構成上ルール
- 各ページの `<title>` は `data-i18n` で多言語化されている
- 各ページは `<h1>` を1つ持ち、ギャラリー見出しは `<h2>` を使用している
- ギャラリー画像の `alt` は作品タイトルベース、TOP注目画像は `タイトル + カテゴリ` 形式
- SNSクローラー向けのdescription / canonical / OGP / Twitter CardはHTMLへ静的に出力し、日本語をサイトの基準言語とする
- canonicalとOGPの基準URLは `https://komeueme-website.pages.dev` とする

## 追加・修正ルール
- 新規ページ作成時は必ず `page_title_*` キーを `i18n.js` に追加
- 画像追加時は `title` 未設定を禁止（`alt` 生成品質に直結）
- 新規HTML追加時と作品ページ再生成後は `node scripts/apply-site-meta.js` を実行し、静的メタ情報とフッター導線を揃える
- 作品詳細のOGPは作品名・作品説明・代表画像を使用する

## 検索流入向けの最小改善指針
- 作品カテゴリ名（木版画/銅版画/デジタル/漫画）を見出しとタイトルで明示
- 主要導線（販売・問い合わせ）に意味のあるリンク文言を使う
- 内部リンクのアンカーテキストを汎用語（"こちら"）にしない

## 公開前チェック
- 全ページで `title` が適切に表示される
- 全ページで `h1` が1つ
- 主要画像の `alt` が空でない
- 言語切替後も title/caption/導線文言が破綻しない
- 全公開ページにdescription / canonical / `og:title` / `og:description` / `og:image` が1件ずつ存在する
- OGP画像のローカル参照先が存在し、公開URLから取得できる
