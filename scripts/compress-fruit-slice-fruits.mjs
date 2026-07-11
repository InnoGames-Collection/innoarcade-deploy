#!/usr/bin/env node
/**
 * Build premium fruit-slice WebP assets from source PNGs.
 * Trims white studio backgrounds, resizes for retina, preserves alpha.
 */

import { readdir, stat, copyFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '../src/games/fruit-slice/fruits/src');
const OUT_DIR = join(__dirname, '../src/games/fruit-slice/fruits');
const MAX = 384;
const WEBP_OPTS = { quality: 92, alphaQuality: 100, effort: 6 };

const FRUITS = ['apple', 'banana', 'cherry', 'orange', 'peach'];

async function processFruit(name) {
  const candidates = ['png', 'jpg', 'jpeg', 'webp'].map((ext) => join(SRC_DIR, `${name}.${ext}`));
  let src = null;
  for (const c of candidates) {
    try { await stat(c); src = c; break; } catch { /* next */ }
  }
  if (!src) {
    console.log(`skip  ${name} (no source in fruits/src/)`);
    return null;
  }

  const dst = join(OUT_DIR, `${name}.webp`);
  const before = (await stat(src)).size;

  let pipeline = sharp(src)
    .trim({ threshold: 18, background: { r: 255, g: 255, b: 255 } })
    .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: false })
    .ensureAlpha();

  await pipeline.webp(WEBP_OPTS).toFile(dst);

  const after = (await stat(dst)).size;
  const meta = await sharp(dst).metadata();
  console.log(`${basename(src)} → ${name}.webp  ${meta.width}×${meta.height}  ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
  return { before, after };
}

async function main() {
  await mkdir(SRC_DIR, { recursive: true });
  const fromArgs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const names = fromArgs.length ? fromArgs : FRUITS;

  let totalBefore = 0;
  let totalAfter = 0;
  for (const name of names) {
    const r = await processFruit(name);
    if (r) { totalBefore += r.before; totalAfter += r.after; }
  }
  if (totalAfter) {
    console.log(`Total output: ${(totalAfter / 1024).toFixed(0)} KB`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
