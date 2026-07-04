# update_workflow.md

## 標準フロー
1. 変更対象を決める（ページ/ファイル/目的を1行で記載）
2. DOM規約確認（`data-gallery`, `data-i18n`, `.caption*`, `.work*`）
3. スタイル変更時は既存スケールに合わせる（13/14/15/16/20px帯中心）
4. 実装
   - 画像元が `/Users/IHEI1/展示関係/portfolio-img` の場合は「コピーのみ」で取り込み、原本を削除/移動/上書きしない
   - 作品画像を変更した場合は `node scripts/generate-list-thumbnails.js` で一覧JPEG/PNGとAVIF 1倍・2倍版を生成する
5. レビュー（デザイン/実装/文言）
6. i18n全ページ確認
7. `node scripts/apply-site-meta.js` と `node scripts/generate-sitemap.js` を実行
8. 完了記録

## Profile・作家略歴PDFの更新
- `profile-data.json` を正本として、基本情報・ステートメント・学歴・受賞歴・展示歴・連絡先を更新する
- 初回のみ `python3 -m pip install -r requirements-pdf.txt` でPDF生成依存を導入する
- 更新後は `python3 scripts/generate-profile-assets.py` を実行し、`profile.html` と `assets/documents/kome-ume-cv-ja.pdf` を同時に再生成する
- `profile.html` の `PROFILE_DATA_START` から `PROFILE_DATA_END` までは個別に手編集しない
- PDF生成後は `pdfinfo` と `pdftoppm` で2ページ構成・文字切れ・改ページ・QRコードを確認する

## 公開準備
- 新しい作業環境では最初に `node scripts/install-git-hooks.js` を実行する
- コミット時に `.githooks/pre-commit` がサイト更新日、静的メタ情報、サイトマップを更新してステージする
- 名刺URLとInstagram URLは `docs/traffic_sources.md` のUTM付きURLを使い分ける

## 実装チェックリスト
- デザイン
- `main max-width:1180px` と余白体系を崩していない
- 760px/520px の2ブレークポイントで破綻がない
- 実装
- ギャラリーが描画される（`data-gallery` が有効）
- 画像ビューア・続きを読む・もっと見るが動く
- 新規作品の画像順がルール通り（1枚目: 余白なしから最適選定、2枚目: 余白ありで歪み/傾き最小）
- 文言
- 追加文言に `data-i18n` または `data-i18n-html` を設定
- `i18n.js` の ja/en 両方にキー追加済み

## 例外（緊急修正）
- 先に修正可
- 当日中に、変更理由・影響範囲・検証結果を追記する
