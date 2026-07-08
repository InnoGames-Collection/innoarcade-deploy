#!/usr/bin/env node
/** Import a PNG/JPG cover into public/ as optimized WebP for hub cards (4:3, 800×600). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const [srcArg, idArg] = process.argv.slice(2);
if (!srcArg || !idArg) {
  console.error('Usage: node scripts/import-cover.mjs <source.png> <game-id>');
  console.error('Example: node scripts/import-cover.mjs assets/water_sort_cover.png water-sort');
  process.exit(1);
}

const src = path.resolve(srcArg);
if (!fs.existsSync(src)) {
  console.error('Source not found:', src);
  process.exit(1);
}

const slug = idArg.replace(/-/g, '_');
const out = path.join(root, 'public', `${slug}.webp`);

await sharp(src)
  .resize(800, 600, { fit: 'cover', position: 'centre' })
  .webp({ quality: 88, effort: 6 })
  .toFile(out);

const size = fs.statSync(out).size;
console.log(`Cover imported: ${out} (${(size / 1024).toFixed(1)} KB)`);
console.log(`Catalog should reference: '${idArg}': '${slug}.webp'`);
