#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = '/Users/IHEI1/展示関係/portfolio-img';
const DEST_DIR = path.join(ROOT, 'assets', 'works');
const MAX_LONG_EDGE = 2600;
const JPG_QUALITY = '88';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
}

function usage() {
  console.log('Usage: node scripts/import-work-image.js <sourcePath> <destFileName>');
  console.log('Example: node scripts/import-work-image.js "木版画/IMG_1234.jpg" "work-38-01.jpg"');
}

function isImage(file) {
  return /\.(jpe?g|png|webp|heic|heif|tiff?)$/i.test(file);
}

function ensureDestName(name) {
  if (!/^work-\d{2}-\d{2}\.(jpg|jpeg|png|webp)$/i.test(name) && !/^profile-[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(name)) {
    throw new Error('destFileName must match work-XX-YY.(jpg|jpeg|png|webp) or profile-*.{jpg,png,webp}');
  }
}

function absSource(p) {
  if (path.isAbsolute(p)) return p;
  return path.join(SOURCE_ROOT, p);
}

function getSize(file) {
  const out = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
  const w = Number((out.match(/pixelWidth:\s*(\d+)/) || [])[1] || 0);
  const h = Number((out.match(/pixelHeight:\s*(\d+)/) || [])[1] || 0);
  return { w, h };
}

function resizeForWeb(file) {
  const { w, h } = getSize(file);
  if (!w || !h) return { changed: false, reason: 'size-unreadable' };
  const long = Math.max(w, h);
  if (long <= MAX_LONG_EDGE) return { changed: false, reason: 'already-small-enough' };

  const target = w >= h
    ? { w: MAX_LONG_EDGE, h: Math.round((h / w) * MAX_LONG_EDGE) }
    : { h: MAX_LONG_EDGE, w: Math.round((w / h) * MAX_LONG_EDGE) };

  run('sips', ['-z', String(target.h), String(target.w), file]);
  return { changed: true, from: `${w}x${h}`, to: `${target.w}x${target.h}` };
}

function maybeSetJpegQuality(file) {
  if (/\.(jpe?g)$/i.test(file)) run('sips', ['-s', 'formatOptions', JPG_QUALITY, file]);
}

function main() {
  const [srcArg, destName] = process.argv.slice(2);
  if (!srcArg || !destName) {
    usage();
    process.exit(1);
  }

  ensureDestName(destName);
  const src = absSource(srcArg);
  if (!fs.existsSync(src)) throw new Error(`source not found: ${src}`);
  if (!isImage(src)) throw new Error('source is not a supported image');

  fs.mkdirSync(DEST_DIR, { recursive: true });
  const dest = path.join(DEST_DIR, destName);

  const srcExt = path.extname(src).toLowerCase();
  const destExt = path.extname(dest).toLowerCase();

  if (srcExt === destExt && !/\.(heic|heif|tiff?)$/i.test(srcExt)) {
    fs.copyFileSync(src, dest);
  } else {
    // Convert through sips when extension differs or source format is not web-friendly.
    run('sips', [src, '--setProperty', 'format', destExt.replace('.', ''), '--out', dest]);
  }

  const resize = resizeForWeb(dest);
  maybeSetJpegQuality(dest);

  const rel = path.relative(ROOT, dest);
  if (resize.changed) {
    console.log(`imported: ${rel} (${resize.from} -> ${resize.to})`);
  } else {
    console.log(`imported: ${rel} (${resize.reason})`);
  }
}

main();
