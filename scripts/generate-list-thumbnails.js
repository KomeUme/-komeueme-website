#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const WORKS_DIR = path.join(ROOT, 'assets', 'works');
const LIST_DIR = path.join(WORKS_DIR, 'list');
const AVIF_DIR = path.join(LIST_DIR, 'avif');
const MAX_LONG_EDGE = 800;
const JPG_QUALITY = '82';
const AVIF_QUALITY = '70';

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

function getJpegOrientationInfo(file) {
  if (!/\.(jpe?g)$/i.test(file)) return null;
  const buffer = fs.readFileSync(file);
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;
    const payload = offset + 4;
    if (
      marker === 0xe1
      && length >= 16
      && buffer.toString("ascii", payload, payload + 6) === "Exif\u0000\u0000"
    ) {
      const tiff = payload + 6;
      const byteOrder = buffer.toString("ascii", tiff, tiff + 2);
      const littleEndian = byteOrder === "II";
      if (!littleEndian && byteOrder !== "MM") return null;
      const readUInt16 = (at) => littleEndian ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at);
      const readUInt32 = (at) => littleEndian ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at);
      if (readUInt16(tiff + 2) !== 42) return null;
      const ifd = tiff + readUInt32(tiff + 4);
      if (ifd + 2 > buffer.length) return null;
      const count = readUInt16(ifd);
      for (let index = 0; index < count; index += 1) {
        const entry = ifd + 2 + (index * 12);
        if (entry + 12 > buffer.length) return null;
        if (readUInt16(entry) !== 0x0112) continue;
        return {
          orientation: readUInt16(entry + 8),
          valueOffset: entry + 8,
          littleEndian,
        };
      }
    }
    offset += 2 + length;
  }
  return null;
}

function setJpegOrientation(file, orientation) {
  const info = getJpegOrientationInfo(file);
  if (!info) return;
  const buffer = fs.readFileSync(file);
  if (info.littleEndian) {
    buffer.writeUInt16LE(orientation, info.valueOffset);
  } else {
    buffer.writeUInt16BE(orientation, info.valueOffset);
  }
  fs.writeFileSync(file, buffer);
}

function normalizeJpegOrientation(file, orientation) {
  const operations = {
    2: [['-f', 'horizontal']],
    3: [['-r', '180']],
    4: [['-f', 'vertical']],
    5: [['-r', '90'], ['-f', 'horizontal']],
    6: [['-r', '90']],
    7: [['-r', '90'], ['-f', 'vertical']],
    8: [['-r', '270']],
  };
  for (const args of operations[orientation] || []) {
    run('sips', [...args, file]);
  }
  if (orientation >= 2 && orientation <= 8) {
    setJpegOrientation(file, 1);
  }
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
  const orientation = getJpegOrientationInfo(source)?.orientation || 1;

  fs.copyFileSync(source, dest);
  normalizeJpegOrientation(dest, orientation);
  const { w, h } = getSize(dest);
  const target = targetSize(w, h);
  if (target.changed) {
    run('sips', ['-z', String(target.h), String(target.w), dest]);
  }
  if (/\.(jpe?g)$/i.test(dest)) {
    run('sips', ['-s', 'formatOptions', JPG_QUALITY, dest]);
  }

  const before = fs.statSync(source).size;
  let after = fs.statSync(dest).size;
  if (after > before && orientation === 1) {
    fs.copyFileSync(source, dest);
    after = before;
  }
  makeAvifVariant(dest, name, 400, '1x');
  makeAvifVariant(dest, name, 800, '2x');
  return {
    name,
    before,
    after,
    from: `${w}x${h}`,
    to: `${target.w}x${target.h}`,
  };
}

function makeAvifVariant(source, name, maxLongEdge, suffix) {
  const base = path.basename(name, path.extname(name));
  const dest = path.join(AVIF_DIR, `${base}-${suffix}.avif`);
  const temp = path.join(
    require('os').tmpdir(),
    `komeume-${process.pid}-${base}-${suffix}${path.extname(source)}`
  );
  fs.copyFileSync(source, temp);
  const { w, h } = getSize(temp);
  if (Math.max(w, h) > maxLongEdge) {
    run('sips', ['-Z', String(maxLongEdge), temp]);
  }
  run('sips', ['-s', 'format', 'avif', '-s', 'formatOptions', AVIF_QUALITY, temp, '--out', dest]);
  fs.unlinkSync(temp);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

function main() {
  const sources = collectSources(process.argv.slice(2));
  fs.mkdirSync(LIST_DIR, { recursive: true });
  fs.mkdirSync(AVIF_DIR, { recursive: true });

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
