const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const i18nPath = path.join(root, "i18n.js");
const visibleFilePattern = /^(?:index|about|profile|shop|hanga|hanga-wood|hanga-copper|digital-illustration|digital-mini-chara|manga-4koma|manga-story|work-\d+)\.html$|^(?:app|data|i18n|styles)\.js$|^assets\/|^icons\/|^text\//;

function formatToday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}.${values.month}.${values.day}`;
}

function getChangedFiles() {
  const output = execFileSync("git", ["status", "--short"], {
    cwd: root,
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((file) => file.replace(/^"|"$/g, ""));
}

function updateI18nDate(date) {
  const source = fs.readFileSync(i18nPath, "utf8");
  const updated = source.replace(
    /site_updated_date: "\d{4}\.\d{2}\.\d{2}"/g,
    `site_updated_date: "${date}"`
  );
  if (source === updated) return false;
  fs.writeFileSync(i18nPath, updated);
  return true;
}

const changedFiles = getChangedFiles();
const hasVisibleSiteChange = changedFiles.some((file) => visibleFilePattern.test(file));

if (!hasVisibleSiteChange) {
  console.log("site update date unchanged: no visible site changes detected");
  process.exit(0);
}

const date = formatToday();
const changed = updateI18nDate(date);
console.log(changed ? `site update date set to ${date}` : `site update date already ${date}`);
