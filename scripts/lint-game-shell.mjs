#!/usr/bin/env node
/** Phase 4 — lint game shell HTML for branding contract (non-stable games). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogSrc = fs.readFileSync(path.join(root, 'src/platform/catalog.ts'), 'utf8');

const stableBlock = catalogSrc.match(/const STABLE_VERSIONS[^=]*=\s*\{([\s\S]*?)\};/);
const stable = new Set();
if (stableBlock) {
  for (const m of stableBlock[1].matchAll(/'([^']+)':\s*'v\d+'/g)) stable.add(m[1]);
}

const ARCADE = new Set([
  'crossy-road', 'stack-tower', 'helix-jump', 'knife-hit', 'hill-climb',
  'tower-defense', 'draw-bridge', 'doodle-jump', 'zigzag', 'color-switch',
  'rope-rescue', 'ball-maze', 'arrow-shot', 'race-car',
]);

const BRAIN = new Set([
  'water-sort', 'parking-jam', 'laser-puzzle', 'block-blast', 'tile-connect',
  'hexa-block', 'ball-sort', 'pipe-connect', 'slide-puzzle',
]);

const CASUAL = new Set(['jewel-match', 'reflex-tap', 'piano-tiles']);

const errors = [];

function expect(html, id, cond, msg) {
  if (!cond) errors.push(`${id}: ${msg}`);
}

for (const id of fs.readdirSync(path.join(root, 'games'))) {
  const htmlPath = path.join(root, 'games', id, 'index.html');
  if (!fs.existsSync(htmlPath)) continue;

  const html = fs.readFileSync(htmlPath, 'utf8');
  const isStable = stable.has(id);

  expect(html, id, html.includes('class="game-shell'), 'missing game-shell on body');
  expect(html, id, html.includes(`data-game="${id}"`), 'missing data-game attribute');

  if (!isStable) {
    expect(html, id, !html.includes('onclick="if(history.length'), 'inline history.back onclick (use wireFreeShellCloseButtons)');
    expect(html, id, html.includes('#menuOverlay') || html.includes('id="menuOverlay"'), 'missing #menuOverlay');
  }

  if (ARCADE.has(id)) {
    expect(html, id, html.includes('arcade-shell'), 'arcade game should use arcade-shell body class');
    expect(html, id, html.includes('arc-canvas-wrap'), 'arcade game should wrap canvas in arc-canvas-wrap');
  }
  if (BRAIN.has(id)) {
    expect(html, id, html.includes('brain-shell') || html.includes('casual-shell'), 'brain game should use brain-shell or casual-shell');
    expect(html, id, html.includes('lq-mount'), 'brain game should mount at #lq-mount');
  }
  if (CASUAL.has(id)) {
    expect(html, id, html.includes('casual-shell'), 'casual game should use casual-shell');
    expect(html, id, html.includes('fcPlayFrame'), 'casual game should use #fcPlayFrame');
  }
}

if (errors.length) {
  console.error('Game shell lint failed:\n' + errors.map((e) => `  • ${e}`).join('\n'));
  process.exit(1);
}

console.log('Game shell lint passed for', fs.readdirSync(path.join(root, 'games')).filter((d) =>
  fs.existsSync(path.join(root, 'games', d, 'index.html'))).length, 'games');
