#!/usr/bin/env node
/**
 * Phase 1 — ethio_f skin prep: checkerboard removal, trim, foot-anchor normalize.
 *
 * Input:  skins/ethio_f/run/run_*.png  → walk1…walk6 (6-frame rear run cycle)
 *         skins/ethio_f/img/*.jpeg      → stand, jump, slide, hit
 * Output: skins/ethio_f/{stand,walk1…walk6,jump,slide,hit}.png
 */

import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SKIN_DIR = join(ROOT, 'src/games/temple-dash/skins/ethio_f');
const INPUT_DIR = join(SKIN_DIR, 'img');
const RUN_DIR = join(SKIN_DIR, 'run');
const RUN_FRAMES = 6;

/** WhatsApp timestamp fragment → output pose (non-run poses). */
const POSE_MAP = {
  '12.36.51': 'stand',
  '12.40.45': 'slide',
  '12.40.29': 'jump',
  '12.42.33': 'hit',
};

const PAD_X = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 8;

function isBackgroundPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;
  // White / light checker squares
  if (spread <= 28 && min >= 165) return true;
  // Mid-gray checker squares (~#b0b0b0–#d0d0d0)
  if (spread <= 22 && min >= 105 && max <= 225) return true;
  return false;
}

/** Flood-fill neutral background from image edges; returns RGBA buffer with alpha cleared. */
function removeBackground(rgba, width, height) {
  const out = Buffer.from(rgba);
  const visited = new Uint8Array(width * height);
  const queue = [];

  const pushIfBg = (x, y) => {
    const i = (y * width + x) * 4;
    if (visited[y * width + x]) return;
    if (!isBackgroundPixel(out[i], out[i + 1], out[i + 2])) return;
    visited[y * width + x] = 1;
    queue.push(x, y);
  };

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    const i = (y * width + x) * 4;
    out[i + 3] = 0;

    if (x > 0) pushIfBg(x - 1, y);
    if (x < width - 1) pushIfBg(x + 1, y);
    if (y > 0) pushIfBg(x, y - 1);
    if (y < height - 1) pushIfBg(x, y + 1);
  }

  return out;
}

function bbox(rgba, width, height, alphaThreshold = 16) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = rgba[(y * width + x) * 4 + 3];
      if (a <= alphaThreshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function footCenterX(rgba, width, height, alphaThreshold = 16) {
  const band = Math.max(3, Math.floor(height * 0.08));
  let sumX = 0;
  let count = 0;
  for (let y = height - band; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > alphaThreshold) {
        sumX += x;
        count++;
      }
    }
  }
  return count ? sumX / count : width / 2;
}

function poseFromRunFilename(name) {
  const m = name.match(/run_(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > RUN_FRAMES) return null;
  return `walk${n}`;
}

function poseFromFilename(name) {
  for (const [stamp, pose] of Object.entries(POSE_MAP)) {
    if (name.includes(stamp)) return pose;
  }
  return null;
}

async function loadProcessed(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleared = removeBackground(data, info.width, info.height);
  const box = bbox(cleared, info.width, info.height);
  if (!box) throw new Error(`no opaque pixels after background removal: ${filePath}`);

  const cropped = await sharp(cleared, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(box)
    .png()
    .toBuffer();

  const meta = await sharp(cropped).metadata();
  const { data: cropPx } = await sharp(cropped).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const footX = footCenterX(cropPx, meta.width, meta.height);
  return { buffer: cropped, width: meta.width, height: meta.height, footX };
}

async function main() {
  await mkdir(SKIN_DIR, { recursive: true });
  const jobs = [];

  for (const file of (await readdir(RUN_DIR)).sort()) {
    if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
    const pose = poseFromRunFilename(file);
    if (!pose) {
      console.log(`skip  run/${file} (expected run_1 … run_${RUN_FRAMES})`);
      continue;
    }
    jobs.push({ file: `run/${file}`, pose, path: join(RUN_DIR, file) });
  }

  for (const file of (await readdir(INPUT_DIR)).sort()) {
    if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
    const pose = poseFromFilename(file);
    if (!pose) {
      console.log(`skip  img/${file} (not in pose map)`);
      continue;
    }
    jobs.push({ file: `img/${file}`, pose, path: join(INPUT_DIR, file) });
  }

  if (jobs.length === 0) {
    console.error('No pose images found.');
    console.error(`  Run cycle: ${RUN_DIR}/run_1.png … run_${RUN_FRAMES}.png`);
    console.error(`  Other poses: ${INPUT_DIR} (WhatsApp JPEGs)`);
    process.exit(1);
  }

  console.log(`Processing ${jobs.length} poses\n`);

  const processed = new Map();
  for (const job of jobs) {
    const result = await loadProcessed(job.path);
    processed.set(job.pose, result);
    console.log(`  ${job.pose.padEnd(6)} ← ${job.file} (${result.width}×${result.height})`);
  }

  let maxW = 0;
  let maxH = 0;
  for (const { width, height } of processed.values()) {
    maxW = Math.max(maxW, width);
    maxH = Math.max(maxH, height);
  }

  const canvasW = maxW + PAD_X * 2;
  const canvasH = maxH + PAD_TOP + PAD_BOTTOM;

  const manifest = { canvas: { width: canvasW, height: canvasH }, poses: {} };

  for (const [pose, { buffer, width, height, footX }] of processed) {
    const left = Math.round(canvasW / 2 - footX);
    const top = PAD_TOP + (maxH - height); // feet aligned to common baseline
    const outPath = join(SKIN_DIR, `${pose}.png`);

    await sharp({
      create: {
        width: canvasW,
        height: canvasH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: buffer, left, top }])
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    manifest.poses[pose] = { file: `${pose}.png`, crop: { width, height }, footX, placedAt: { left, top } };
    console.log(`wrote ${outPath}`);
  }

  // Shop thumbnail = stand pose, copied for backward-compatible ./skins/ethio_f.png path.
  const standPath = join(SKIN_DIR, 'stand.png');
  const legacyThumb = join(SKIN_DIR, '..', 'ethio_f.png');
  await sharp(standPath).png().toFile(legacyThumb);
  console.log(`wrote ${legacyThumb} (legacy shop thumb from stand)`);

  const manifestPath = join(SKIN_DIR, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${manifestPath}`);

  const required = [
    'stand', 'jump', 'slide',
    ...Array.from({ length: RUN_FRAMES }, (_, i) => `walk${i + 1}`),
  ];
  const missing = required.filter((p) => !processed.has(p));
  if (missing.length) {
    console.warn(`\nWarning: missing gameplay poses: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`\nDone — ${RUN_FRAMES}-frame run cycle (walk1…walk${RUN_FRAMES}).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
