#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WORKS_DIR = path.join(ROOT, 'assets', 'works');
const MAX_LONG_EDGE = 2600;
const JPG_QUALITY = '88';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function getSize(file) {
  const out = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
  const w = Number((out.match(/pixelWidth:\s*(\d+)/) || [])[1] || 0);
  const h = Number((out.match(/pixelHeight:\s*(\d+)/) || [])[1] || 0);
  return { w, h };
}

function shouldHandle(file) {
  return /\.(jpe?g|png|webp)$/i.test(file);
}

function collectTargets(args) {
  if (args.length === 0) {
    return fs.readdirSync(WORKS_DIR)
      .filter((name) => shouldHandle(name))
      .map((name) => path.join(WORKS_DIR, name));
  }

  return args.map((p) => {
    const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
    if (!fs.existsSync(abs)) throw new Error(`not found: ${p}`);
    return abs;
  }).filter(shouldHandle);
}

function optimize(file) {
  const { w, h } = getSize(file);
  if (!w || !h) return { file, changed: false, reason: 'size-unreadable' };

  const longEdge = Math.max(w, h);
  if (longEdge <= MAX_LONG_EDGE) {
    return { file, changed: false, reason: 'already-small-enough' };
  }

  const target = w >= h
    ? { w: MAX_LONG_EDGE, h: Math.round((h / w) * MAX_LONG_EDGE) }
    : { h: MAX_LONG_EDGE, w: Math.round((w / h) * MAX_LONG_EDGE) };

  run('sips', ['-z', String(target.h), String(target.w), file]);

  if (/\.(jpe?g)$/i.test(file)) {
    run('sips', ['-s', 'formatOptions', JPG_QUALITY, file]);
  }

  return { file, changed: true, from: `${w}x${h}`, to: `${target.w}x${target.h}` };
}

function main() {
  const args = process.argv.slice(2);
  const targets = collectTargets(args);
  if (!targets.length) {
    console.log('no image targets');
    return;
  }

  let changed = 0;
  for (const file of targets) {
    const r = optimize(file);
    const rel = path.relative(ROOT, file);
    if (r.changed) {
      changed += 1;
      console.log(`optimized: ${rel} (${r.from} -> ${r.to})`);
    } else {
      console.log(`skip: ${rel} (${r.reason})`);
    }
  }
  console.log(`done: ${changed}/${targets.length} optimized`);
}

main();
