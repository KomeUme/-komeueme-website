#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const siteUrl = "https://komeueme-website.pages.dev";
const defaultImage = "assets/works/work-12-01.jpg";
const privacyVersion = "20260704a";

const pageMeta = {
  "index.html": ["Kome Ume portfolio", "米鵜めえの作品、展示情報、略歴を掲載するポートフォリオサイト。", defaultImage],
  "about.html": ["About | Kome Ume", "米鵜めえのSNSと仕事に関する連絡先。", defaultImage],
  "profile.html": ["Profile | Kome Ume", "米鵜めえの略歴、受賞歴、展示歴、学歴。", defaultImage],
  "privacy.html": ["プライバシーポリシー | Kome Ume", "Kome Umeウェブサイトにおける個人情報の取り扱いについて。", defaultImage],
  "404.html": ["ページが見つかりません | Kome Ume", "指定されたページは見つかりませんでした。", defaultImage],
  "news.html": ["お知らせ | Kome Ume", "米鵜めえの展示などに関するお知らせ。", defaultImage],
  "hanga.html": ["版画 | Kome Ume", "米鵜めえの版画作品一覧。", "assets/works/work-12-01.jpg"],
  "hanga-wood.html": ["木版画 | Kome Ume", "米鵜めえの木版画作品一覧。", "assets/works/work-12-01.jpg"],
  "hanga-copper.html": ["銅版画 | Kome Ume", "米鵜めえの銅版画作品一覧。", "assets/works/work-16-01.jpg"],
  "digital-illustration.html": ["デジタル（イラスト） | Kome Ume", "米鵜めえのデジタルイラスト作品一覧。", "assets/works/work-23-01.jpg"],
  "digital-mini-chara.html": ["デジタル（ミニキャラ） | Kome Ume", "米鵜めえのミニキャラ作品一覧。", "assets/works/work-49-01.png"],
  "manga.html": ["漫画 | Kome Ume", "米鵜めえの漫画作品一覧。", "assets/works/work-53-01.jpg"],
  "manga-4koma.html": ["四コマ | Kome Ume", "米鵜めえの四コマ漫画作品一覧。", "assets/works/work-53-01.jpg"],
  "manga-story.html": ["ストーリー | Kome Ume", "米鵜めえのストーリー漫画作品一覧。", "assets/works/work-41-01.jpg"],
  "shop.html": ["販売 | Kome Ume", "米鵜めえの版画作品販売ページ。", "assets/works/work-12-01.jpg"],
  "shop-print.html": ["版画販売 | Kome Ume", "米鵜めえの版画作品販売ページ。", "assets/works/work-12-01.jpg"],
  "shop-digital.html": ["デジタル販売 | Kome Ume", "米鵜めえのデジタル作品販売ページ。", "assets/works/work-23-01.jpg"],
};

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function loadWorks() {
  const source = fs.readFileSync(path.join(root, "data.js"), "utf8");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__works = works;`, sandbox);
  return new Map(sandbox.__works.map((work) => [String(work.id), work]));
}

function getMeta(file, works) {
  const workMatch = file.match(/^work-(.+)\.html$/);
  if (!workMatch) return pageMeta[file] || ["Kome Ume portfolio", pageMeta["index.html"][1], defaultImage];

  const work = works.get(workMatch[1].replace(/^0+(?=\d)/, "")) || works.get(workMatch[1]);
  if (!work) return [`作品 | Kome Ume`, "米鵜めえの作品詳細。", defaultImage];
  const title = String(work.title || "作品");
  const details = [work.technique, work.year, work.caption]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("。");
  const description = details ? `${title}。${details}`.slice(0, 150) : `${title}。米鵜めえの作品詳細。`;
  const image = String(work.image || work.images?.[0] || defaultImage);
  return [`${title} | Kome Ume`, description, image];
}

function buildMeta(file, title, description, image) {
  const pagePath = file === "index.html" ? "/" : `/${file}`;
  const canonical = `${siteUrl}${pagePath}`;
  const imageUrl = `${siteUrl}/${encodeURI(image)}`;
  const type = file.startsWith("work-") ? "article" : "website";
  return `  <!-- site-meta:start -->
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <meta name="description" content="${escapeAttribute(description)}">
  <link rel="canonical" href="${escapeAttribute(canonical)}">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="Kome Ume">
  <meta property="og:title" content="${escapeAttribute(title)}">
  <meta property="og:description" content="${escapeAttribute(description)}">
  <meta property="og:url" content="${escapeAttribute(canonical)}">
  <meta property="og:image" content="${escapeAttribute(imageUrl)}">
  <meta property="og:image:alt" content="${escapeAttribute(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttribute(title)}">
  <meta name="twitter:description" content="${escapeAttribute(description)}">
  <meta name="twitter:image" content="${escapeAttribute(imageUrl)}">
  <!-- site-meta:end -->`;
}

function applyMeta(html, meta) {
  const markerPattern = /  <!-- site-meta:start -->[\s\S]*?  <!-- site-meta:end -->/;
  if (markerPattern.test(html)) return html.replace(markerPattern, meta);
  return html.replace(
    /(<meta name="viewport"[^>]*>)/,
    `$1\n${meta}`
  );
}

function applyFooter(html) {
  const footer = `<footer><span>© Kome Ume</span><a class="footer-privacy-link" href="privacy.html?v=${privacyVersion}" data-i18n="footer_privacy">プライバシー</a></footer>`;
  return html.replace(/<footer>(?:<span>© Kome Ume<\/span><a class="footer-privacy-link"[\s\S]*?<\/a>|© Kome Ume)<\/footer>/, footer);
}

function main() {
  const works = loadWorks();
  const files = fs.readdirSync(root).filter((file) => file.endsWith(".html"));
  for (const file of files) {
    const filePath = path.join(root, file);
    const [title, description, image] = getMeta(file, works);
    let html = fs.readFileSync(filePath, "utf8");
    html = applyMeta(html, buildMeta(file, title, description, image));
    html = applyFooter(html);
    fs.writeFileSync(filePath, html);
  }
  console.log(`updated metadata and footer in ${files.length} HTML files`);
}

main();
