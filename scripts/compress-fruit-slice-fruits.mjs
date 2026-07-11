#!/usr/bin/env node
/**
 * Build premium fruit-slice WebP assets from source PNGs.
 * Removes white studio backgrounds → transparent, trims, resizes.
 */

import { stat, mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '../src/games/fruit-slice/fruits/src');
const OUT_DIR = join(__dirname, '../src/games/fruit-slice/fruits');
const MAX = 384;
const WEBP_OPTS = { quality: 92, alphaQuality: 100, effort: 6 };

const FRUITS = ['apple', 'banana', 'cherry', 'orange', 'peach'];

/** Convert near-white / low-saturation background pixels to transparent (feathered). */
function knockOutWhite(data, channels, opts = {}) {
  const threshold = opts.threshold ?? 228;
  const satMax = opts.satMax ?? 38;
  const softness = opts.softness ?? 32;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels === 4 ? data[i + 3] : 255;
    if (a === 0) continue;

    const brightness = (r + g + b) / 3;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);

    if (brightness >= threshold && sat <= satMax) {
      const fade = Math.min(1, (brightness - threshold + softness) / softness);
      const newA = Math.round(a * (1 - fade));
      if (channels === 4) data[i + 3] = newA;
    }
  }
}

async function removeWhiteBackground(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  knockOutWhite(data, info.channels);

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  }).png();
}

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

  const cutout = await removeWhiteBackground(src);

  await cutout
    .trim({ threshold: 1 })
    .resize(MAX, MAX, { fit: 'inside', withoutEnlargement: false })
    .webp(WEBP_OPTS)
    .toFile(dst);

  const after = (await stat(dst)).size;
  const meta = await sharp(dst).metadata();
  console.log(`${basename(src)} → ${name}.webp  ${meta.width}×${meta.height}  α=${meta.hasAlpha}  ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
  return { before, after };
}

async function main() {
  await mkdir(SRC_DIR, { recursive: true });
  const fromArgs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const names = fromArgs.length ? fromArgs : FRUITS;

  let totalAfter = 0;
  for (const name of names) {
    const r = await processFruit(name);
    if (r) totalAfter += r.after;
  }
  if (totalAfter) console.log(`Total output: ${(totalAfter / 1024).toFixed(0)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
