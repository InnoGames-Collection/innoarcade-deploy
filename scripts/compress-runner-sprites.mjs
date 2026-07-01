#!/usr/bin/env node
/**
 * Phase 6 — compress ethio_f runner pose sprites to WebP (alpha preserved).
 * Replaces large per-pose PNGs (~1.5 MB total) with WebP (~150 KB).
 *
 * Usage: node scripts/compress-runner-sprites.mjs [--keep-png]
 * Default: write .webp and remove the source .png for bundled poses + shop thumb.
 */

import { readdir, stat, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SKIN_DIR = join(ROOT, 'src/games/temple-dash/skins/ethio_f');
const THUMB_PNG = join(ROOT, 'src/games/temple-dash/skins/ethio_f.png');
const THUMB_WEBP = join(ROOT, 'src/games/temple-dash/skins/ethio_f.webp');

const POSES = [
  'stand',
  'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6',
  'jump', 'slide', 'hit',
];

const WEBP_OPTS = { quality: 82, alphaQuality: 90, effort: 4 };

async function toWebp(pngPath, webpPath) {
  const before = (await stat(pngPath)).size;
  await sharp(pngPath).webp(WEBP_OPTS).toFile(webpPath);
  const after = (await stat(webpPath)).size;
  return { before, after };
}

async function main() {
  const keepPng = process.argv.includes('--keep-png');
  let totalBefore = 0;
  let totalAfter = 0;
  let count = 0;

  for (const pose of POSES) {
    const pngPath = join(SKIN_DIR, `${pose}.png`);
    try {
      await stat(pngPath);
    } catch {
      console.log(`skip  ${pose}.png (missing)`);
      continue;
    }
    const webpPath = join(SKIN_DIR, `${pose}.webp`);
    const { before, after } = await toWebp(pngPath, webpPath);
    totalBefore += before;
    totalAfter += after;
    count++;
    console.log(`  ${pose.padEnd(6)} ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB  (${webpPath.split('/').pop()})`);
    if (!keepPng) await unlink(pngPath);
  }

  try {
    await stat(THUMB_PNG);
    const { before, after } = await toWebp(THUMB_PNG, THUMB_WEBP);
    totalBefore += before;
    totalAfter += after;
    count++;
    console.log(`  thumb   ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB  (ethio_f.webp)`);
    if (!keepPng) await unlink(THUMB_PNG);
  } catch {
    console.log('skip  ethio_f.png thumb (missing)');
  }

  console.log(`\nCompressed ${count} files: ${(totalBefore / 1024).toFixed(0)} KB → ${(totalAfter / 1024).toFixed(0)} KB (${Math.round(100 - (totalAfter / totalBefore) * 100)}% smaller)`);
  if (keepPng) console.log('PNG sources kept (--keep-png).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
