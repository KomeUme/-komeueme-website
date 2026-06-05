#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const WORKS_DIR = path.join(ROOT, 'assets', 'works');
const LIST_DIR = path.join(WORKS_DIR, 'list');
const MAX_LONG_EDGE = 800;
const JPG_QUALITY = '82';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function isImage(file) {
  return /\.(jpe?g|png|webp)$/i.test(file);
}

function getSize(file) {
  const out = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
  const w = Number((out.match(/pixelWidth:\s*(\d+)/) || [])[1] || 0);
  const h = Number((out.match(/pixelHeight:\s*(\d+)/) || [])[1] || 0);
  return { w, h };
}

function targetSize(w, h) {
  const long = Math.max(w, h);
  if (!w || !h || long <= MAX_LONG_EDGE) return { w, h, changed: false };
  return w >= h
    ? { w: MAX_LONG_EDGE, h: Math.round((h / w) * MAX_LONG_EDGE), changed: true }
    : { h: MAX_LONG_EDGE, w: Math.round((w / h) * MAX_LONG_EDGE), changed: true };
}

function collectSources(args) {
  if (args.length) {
    return args.map((p) => path.resolve(ROOT, p)).filter((file) => isImage(file));
  }

  const dataPath = path.join(ROOT, 'data.js');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${fs.readFileSync(dataPath, 'utf8')}\nthis.works = works;`, context);

  const sources = new Set();
  for (const work of context.works || []) {
    if (work.image && isImage(work.image)) sources.add(path.join(ROOT, work.image));
    for (const image of work.images || []) {
      if (isImage(image)) sources.add(path.join(ROOT, image));
    }
  }
  return [...sources];
}

function makeThumbnail(source) {
  const name = path.basename(source);
  const dest = path.join(LIST_DIR, name);
  const { w, h } = getSize(source);
  const target = targetSize(w, h);

  fs.copyFileSync(source, dest);
  if (target.changed) {
    run('sips', ['-z', String(target.h), String(target.w), dest]);
  }
  if (/\.(jpe?g)$/i.test(dest)) {
    run('sips', ['-s', 'formatOptions', JPG_QUALITY, dest]);
  }

  const before = fs.statSync(source).size;
  let after = fs.statSync(dest).size;
  if (after > before) {
    fs.copyFileSync(source, dest);
    after = before;
  }
  return {
    name,
    before,
    after,
    from: `${w}x${h}`,
    to: `${target.w}x${target.h}`,
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

function main() {
  const sources = collectSources(process.argv.slice(2));
  fs.mkdirSync(LIST_DIR, { recursive: true });

  let beforeTotal = 0;
  let afterTotal = 0;
  for (const source of sources) {
    const result = makeThumbnail(source);
    beforeTotal += result.before;
    afterTotal += result.after;
    console.log(
      `${result.name}: ${result.from} -> ${result.to}, ${formatBytes(result.before)} -> ${formatBytes(result.after)}`
    );
  }
  console.log(`done: ${sources.length} thumbnails, ${formatBytes(beforeTotal)} -> ${formatBytes(afterTotal)}`);
}

main();
