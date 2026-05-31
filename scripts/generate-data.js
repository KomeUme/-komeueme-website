#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'data.js');
const textRoot = path.join(root, 'assets', 'text');

function loadWorks(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${code}\nthis.__works = works;`, sandbox);
  return sandbox.__works;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function parseCaptionTxt(content) {
  const get = (label) => {
    const m = content.match(new RegExp(`^${label}：\\s*(.*)$`, 'm'));
    return m ? m[1].trim() : '';
  };
  const title = get('タイトル');
  const year = get('制作年');
  const technique = get('技法');
  const size = get('サイズ');
  const capIdx = content.indexOf('キャプション：');
  const caption = capIdx >= 0 ? content.slice(capIdx + 'キャプション：'.length).trim() : '';
  return { title, year, technique, size, caption };
}

function buildTextMap(rootDir) {
  const map = new Map();
  const txtFiles = walk(rootDir).filter((f) => f.toLowerCase().endsWith('.txt'));
  for (const file of txtFiles) {
    const parsed = parseCaptionTxt(fs.readFileSync(file, 'utf8'));
    if (!parsed.title) continue;
    if (!map.has(parsed.title)) map.set(parsed.title, parsed);
  }
  return map;
}

function main() {
  const works = loadWorks(dataPath);
  const textMap = buildTextMap(textRoot);

  const merged = works.map((w) => {
    const t = textMap.get(w.title);
    if (!t) return w;
    return {
      ...w,
      title: t.title || w.title,
      year: t.year,
      technique: t.technique,
      size: t.size,
      caption: t.caption,
    };
  });

  const output = `const works = ${JSON.stringify(merged, null, 2)};\n\nconst categories = {\n  "all": "All works",\n  "hanga": "版画",\n  "digital": "デジタル",\n  "manga": "漫画"\n};\n`;
  fs.writeFileSync(dataPath, output, 'utf8');

  const covered = merged.filter((w) => textMap.has(w.title)).length;
  console.log(`generated: ${merged.length} works (text matched: ${covered})`);
}

main();
