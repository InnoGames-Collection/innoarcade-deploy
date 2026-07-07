#!/usr/bin/env node
/** Wire Phase 3 arcade onboarding + analytics into new game mains. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/games');

const ARCADE = [
  { id: 'knife-hit', budget: 120 },
  { id: 'helix-jump', budget: 120 },
  { id: 'stack-tower', budget: 120 },
  { id: 'hill-climb', budget: 90 },
  { id: 'tower-defense', budget: 180 },
  { id: 'draw-bridge', budget: 120 },
  { id: 'doodle-jump', budget: 90 },
  { id: 'zigzag', budget: 90 },
  { id: 'color-switch', budget: 90 },
  { id: 'rope-rescue', budget: 120 },
  { id: 'ball-maze', budget: 120 },
  { id: 'arrow-shot', budget: 120 },
  { id: 'race-car', budget: 90 },
  { id: 'crossy-road', budget: 90, skipFirstRun: true },
];

for (const g of ARCADE) {
  const file = path.join(root, g.id, 'main.ts');
  if (!fs.existsSync(file)) {
    console.warn('skip', file);
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  const hasConst = src.includes(`const GAME_ID = '${g.id}'`);
  if (!hasConst) {
    src = src.replace(
      /const host = new GameHost\('([^']+)'\);/,
      `const GAME_ID = '${g.id}';\nconst host = new GameHost(GAME_ID);`,
    );
  }
  src = src.replace(
    /const run = trackArcadeRunStart\(\);/,
    'const run = trackArcadeRunStart(GAME_ID);',
  );
  const chromeOpts = g.skipFirstRun
    ? `{ playWrapper, backdrop: $('#fcBackdrop'), shell, gameId: GAME_ID, skipFirstRun: true }`
    : `{ playWrapper, backdrop: $('#fcBackdrop'), shell, gameId: GAME_ID }`;
  src = src.replace(
    /bindHubCanvasChrome\(\{ playWrapper, backdrop: \$\('#fcBackdrop'\), shell \}\)/,
    `bindHubCanvasChrome(${chromeOpts})`,
  );
  src = src.replace(
    /submitArcadeScore\(score, run\.getRunStart\(\), shell, \{ budgetSec: \d+ \}\)/,
    `submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: ${g.budget}, gameId: GAME_ID, winScore: host.winScore })`,
  );
  // crossy-road may use different variable names - check
  if (!src.includes('gameId: GAME_ID')) {
    src = src.replace(
      /submitArcadeScore\(([^,]+), run\.getRunStart\(\), shell, (\{[^}]+\})\)/,
      `submitArcadeScore($1, run.getRunStart(), shell, { ...$2, gameId: GAME_ID, winScore: host.winScore })`,
    );
  }
  fs.writeFileSync(file, src);
  console.log('patched', g.id);
}

const LQ = [
  'water-sort', 'parking-jam', 'laser-puzzle', 'tile-connect', 'ball-sort',
  'pipe-connect', 'slide-puzzle', 'block-blast', 'hexa-block', 'piano-tiles',
];

for (const id of LQ) {
  const file = path.join(root, id, 'main.ts');
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/showFirstRunToast/g, 'showFirstRunHint');
  src = src.replace(
    /showFirstRunHint\('([^']+)',\s*'[^']*',\s*toast\)/g,
    "showFirstRunHint('$1', toast)",
  );
  src = src.replace(
    /showFirstRunHint\('([^']+)',\s*'[^']*',\s*\(m\)/g,
    "showFirstRunHint('$1', (m)",
  );
  fs.writeFileSync(file, src);
  console.log('lq', id);
}
