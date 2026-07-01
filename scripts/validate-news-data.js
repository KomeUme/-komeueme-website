const fs = require("fs");
const path = require("path");
const newsItems = require("../news-data.js");

const root = path.resolve(__dirname, "..");
const ids = new Set();
const errors = [];

newsItems.forEach((item, index) => {
  const label = `newsItems[${index}]`;
  const id = String(item?.id ?? "").trim();
  if (!/^[a-z0-9-]+$/.test(id)) errors.push(`${label}: id must use lowercase letters, numbers, and hyphens`);
  if (ids.has(id)) errors.push(`${label}: duplicate id "${id}"`);
  ids.add(id);
  if (typeof item?.published !== "boolean") errors.push(`${label}: published must be true or false`);
  if (!String(item?.title ?? "").trim()) errors.push(`${label}: title is required`);

  const from = item?.displayFrom ? new Date(`${item.displayFrom}T00:00:00`) : null;
  const until = item?.displayUntil ? new Date(`${item.displayUntil}T23:59:59`) : null;
  if (from && Number.isNaN(from.getTime())) errors.push(`${label}: displayFrom is invalid`);
  if (until && Number.isNaN(until.getTime())) errors.push(`${label}: displayUntil is invalid`);
  if (from && until && !Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime()) && from > until) {
    errors.push(`${label}: displayFrom must not be later than displayUntil`);
  }

  const image = String(item?.image ?? "").trim();
  if (image) {
    const imagePath = path.resolve(root, image);
    if (!imagePath.startsWith(`${root}${path.sep}`)) errors.push(`${label}: image must stay inside the site directory`);
    else if (!fs.existsSync(imagePath)) errors.push(`${label}: image not found "${image}"`);
  }
});

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`news data valid: ${newsItems.length} item(s)`);
