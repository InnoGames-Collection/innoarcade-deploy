#!/usr/bin/env node
/** Phase 2 branding — strip inline close handlers from non-stable game shells. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogSrc = fs.readFileSync(path.join(root, 'src/platform/catalog.ts'), 'utf8');

const stable = new Set(
  [...catalogSrc.matchAll(/'([^']+)':\s*'v\d+'/g)]
    .map((m) => m[1])
    .filter((id) => catalogSrc.includes(`id: '${id}'`) || catalogSrc.includes(`'${id}':`)),
);

// Only games with STABLE_VERSIONS entries — parse that block explicitly.
const stableBlock = catalogSrc.match(/const STABLE_VERSIONS[^=]*=\s*\{([\s\S]*?)\};/);
if (stableBlock) {
  stable.clear();
  for (const m of stableBlock[1].matchAll(/'([^']+)':\s*'v\d+'/g)) stable.add(m[1]);
}

const onclickRe = /\s+onclick="if\(history\.length>1\)\{history\.back\(\)\}else\{location\.href='(\.\.\/\.\.\/)?'\}"/g;

const gamesDir = path.join(root, 'games');
for (const id of fs.readdirSync(gamesDir)) {
  if (stable.has(id)) continue;
  const htmlPath = path.join(gamesDir, id, 'index.html');
  if (!fs.existsSync(htmlPath)) continue;
  let html = fs.readFileSync(htmlPath, 'utf8');
  const before = html;
  html = html.replace(onclickRe, '');
  if (html !== before) {
    fs.writeFileSync(htmlPath, html);
    console.log('stripped onclick:', id);
  }
}
