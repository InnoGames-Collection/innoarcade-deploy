#!/usr/bin/env node
/**
 * Process Memory Match card icons: background removal, canvas normalize, PNG export.
 *
 * Usage:
 *   node scripts/process-memory-match-icons.mjs
 *   npm run icons:process
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'assets/memory-match');
const iconsDir = path.join(root, 'src/games/memory-match/icons');
const refDir = path.join(
  process.env.HOME ?? '',
  '.cursor/projects/Users-yasabneh-Documents-ITG-InnoGames/assets',
);

const CANVAS = 1024;
const TARGET_FILL = 0.87;

const REFS = {
  telebirr: 'WhatsApp_Image_2026-07-10_at_4.43.38_PM-f727cd39-cb9f-4360-b864-8326c1ea158b.png',
  ethio: 'WhatsApp_Image_2026-07-10_at_4.44.00_PM-4a12e3e2-1fc6-4067-8c78-cd538d3515fc.png',
  nexsus: 'nexsus-v3.png',
  teleconnect: 'teleconnect-v2.png',
};

function refPath(name) {
  const p = path.join(refDir, REFS[name]);
  if (!fs.existsSync(p)) throw new Error(`Reference not found: ${p}`);
  return p;
}

/** Remove near-white and near-light-gray matte pixels. */
function stripBackground(data, channels, width, height, opts = {}) {
  const {
    lumMin = 238,
    satMax = 28,
    cornerLumMin = 200,
  } = opts;

  const out = Buffer.from(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = max - min;

      const inCorner =
        x < 12 || y < 12 || x >= width - 12 || y >= height - 12;

      const threshold = inCorner ? cornerLumMin : lumMin;
      if (lum >= threshold && sat <= satMax) {
        out[i + 3] = 0;
      }
    }
  }

  return out;
}

async function removeBackground(inputPath, bgOpts) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleaned = stripBackground(data, info.channels, info.width, info.height, bgOpts);

  return sharp(cleaned, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

async function fitToCanvas(input) {
  const maxDim = Math.round(CANVAS * Math.sqrt(TARGET_FILL));

  return sharp(input)
    .trim()
    .resize(maxDim, maxDim, {
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.25 })
    .resize(CANVAS, CANVAS, {
      fit: 'contain',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true });
}

async function exportIcon(pipeline, outPath) {
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  await pipeline.toFile(outPath);
  const stat = fs.statSync(outPath);
  console.log(`  → ${path.relative(root, outPath)} (${(stat.size / 1024).toFixed(0)} KB)`);
}

async function processLogo(name, inputPath, bgOpts) {
  console.log(`Processing ${name}…`);
  const cleaned = await removeBackground(inputPath, bgOpts);
  await exportIcon(await fitToCanvas(cleaned), path.join(assetsDir, `${name}.png`));
}

/** Re-encode without pixel or style changes (Mesob / Jebena). */
async function copyPreserve(name, inputPaths) {
  const candidates = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
  const inputPath = candidates.find((p) => fs.existsSync(p));
  const outPath = path.join(assetsDir, `${name}.png`);

  if (!inputPath) {
    if (fs.existsSync(outPath)) {
      console.log(`Skipping ${name} — source missing, keeping existing asset`);
      return;
    }
    throw new Error(`No source found for ${name}`);
  }

  console.log(`Copying ${name} (preserve pixels)…`);
  const buf = await sharp(inputPath).ensureAlpha().png().toBuffer();
  await exportIcon(await fitToCanvas(buf), outPath);
}

async function deployToGame() {
  const names = ['telebirr', 'ethio-telecom', 'mesob', 'jebena', 'nexsus', 'teleconnect'];
  for (const name of names) {
    const src = path.join(assetsDir, `${name}.png`);
    const dest = path.join(iconsDir, `${name}.png`);
    if (!fs.existsSync(src)) {
      console.warn(`  skip deploy ${name} — source missing`);
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`  deployed ${name}.png`);
  }
}

async function main() {
  const deploy = process.argv.includes('--deploy');

  await processLogo('telebirr', refPath('telebirr'), { lumMin: 240, satMax: 35 });
  await processLogo('ethio-telecom', refPath('ethio'), { lumMin: 225, satMax: 40, cornerLumMin: 180 });
  await processLogo('mesob', path.join(assetsDir, 'source/injera.png'), {
    lumMin: 252,
    satMax: 18,
    cornerLumMin: 245,
  });
  await processLogo('jebena', path.join(assetsDir, 'source/coffee.png'), {
    lumMin: 254,
    satMax: 12,
    cornerLumMin: 250,
  });
  await processLogo('nexsus', refPath('nexsus'), { lumMin: 248, satMax: 20, cornerLumMin: 210 });
  await processLogo('teleconnect', refPath('teleconnect'), { lumMin: 248, satMax: 20, cornerLumMin: 210 });

  if (deploy) {
    console.log('\nDeploying to game icons…');
    await deployToGame();
  }

  console.log('\nDone. Run: npm run icons:validate');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
