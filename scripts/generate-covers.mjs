#!/usr/bin/env node
/** Phase 3 — generate hub cover WebP gradients from catalog thumb colors. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogSrc = fs.readFileSync(path.join(root, 'src/platform/catalog.ts'), 'utf8');

const stableBlock = catalogSrc.match(/const STABLE_VERSIONS[^=]*=\s*\{([\s\S]*?)\};/);
const stable = new Set();
if (stableBlock) {
  for (const m of stableBlock[1].matchAll(/'([^']+)':\s*'v\d+'/g)) stable.add(m[1]);
}

function parseNewGames() {
  const games = [];
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?accent:\s*'([^']+)'[\s\S]*?thumb:\s*\['([^']+)',\s*'([^']+)'\]/g;
  let m;
  while ((m = re.exec(catalogSrc))) {
    const [_, id, accent, thumbA, thumbB] = m;
    if (stable.has(id)) continue;
    if (!catalogSrc.includes(`'${id}': 'covers/`)) continue;
    games.push({ id, accent, thumbA, thumbB });
  }
  return games;
}

function slug(id) {
  return id.replace(/-/g, '_');
}

async function renderCover({ id, thumbA, thumbB, accent }) {
  const w = 640;
  const h = 400;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${thumbA}"/>
      <stop offset="100%" stop-color="${thumbB}"/>
    </linearGradient>
    <radialGradient id="shine" cx="50%" cy="18%" r="65%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#shine)"/>
  <circle cx="${w - 48}" cy="48" r="36" fill="${accent}" opacity="0.22"/>
  <rect x="24" y="${h - 28}" width="120" height="6" rx="3" fill="#ffffff" opacity="0.35"/>
</svg>`;

  const out = path.join(root, 'public', `${slug(id)}.webp`);
  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(out);
  return out;
}

const games = parseNewGames();
if (!games.length) {
  console.error('No new catalog games with SVG covers found.');
  process.exit(1);
}

for (const game of games) {
  const out = await renderCover(game);
  console.log('cover', game.id, '→', path.basename(out));
}

console.log(`Generated ${games.length} WebP covers in public/`);
