// Candy Blast (Pop Blast) — match-3 with hub casual shell.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';
import { finalizeArcadeScore, match3Score, scaleArcadeScore } from '../../platform/arcadeScore';

const host = createHost('popblast');
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const SIZE = 8;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
type Color = typeof COLORS[number];
const START_MOVES = 25;

let grid: (Color | null)[] = [];
let score = 0;
let moves = START_MOVES;
let combo = 0;
let selected = -1;
let busy = false;
let gameEnded = false;
let runStart = 0;

const board = $('#board');
const comboEl = $('#combo');

function idx(r: number, c: number): number {
  return r * SIZE + c;
}

function randColor(): Color {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function findMatches(g: (Color | null)[]): Set<number> {
  const matched = new Set<number>();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const i = idx(r, c);
      const color = g[i];
      if (!color) continue;
      if (c <= SIZE - 3 && g[idx(r, c + 1)] === color && g[idx(r, c + 2)] === color) {
        matched.add(i); matched.add(idx(r, c + 1)); matched.add(idx(r, c + 2));
      }
      if (r <= SIZE - 3 && g[idx(r + 1, c)] === color && g[idx(r + 2, c)] === color) {
        matched.add(i); matched.add(idx(r + 1, c)); matched.add(idx(r + 2, c));
      }
    }
  }
  return matched;
}

function fillNoMatches(): void {
  do {
    grid = Array.from({ length: SIZE * SIZE }, () => randColor());
  } while (findMatches(grid).size > 0);
}

function paintBoard(): void {
  board.innerHTML = '';
  grid.forEach((color, i) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile' + (color ? ` ${color}` : ' empty') + (selected === i ? ' sel' : '');
    tile.dataset.i = String(i);
    tile.disabled = busy || gameEnded || !color;
    tile.addEventListener('click', () => void onTileClick(i));
    board.appendChild(tile);
  });
}

function updateHud(): void {
  shell.setHeader({
    score: String(scaleArcadeScore(score)),
    moves: String(moves),
  });
}

function showCombo(): void {
  comboEl.classList.add('show');
  window.setTimeout(() => comboEl.classList.remove('show'), 700);
}

async function clearMatches(): Promise<boolean> {
  const matched = findMatches(grid);
  if (!matched.size) return false;
  combo++;
  score += match3Score(matched.size, combo);
  updateHud();
  showCombo();
  sfx.coin();
  matched.forEach((i) => { grid[i] = null; });
  paintBoard();
  await wait(180);
  applyGravity();
  refill();
  paintBoard();
  await wait(120);
  if (findMatches(grid).size) {
    await clearMatches();
  } else {
    combo = 0;
  }
  return true;
}

function applyGravity(): void {
  for (let c = 0; c < SIZE; c++) {
    const col: (Color | null)[] = [];
    for (let r = SIZE - 1; r >= 0; r--) {
      const v = grid[idx(r, c)];
      if (v) col.push(v);
    }
    for (let r = SIZE - 1; r >= 0; r--) {
      grid[idx(r, c)] = col[SIZE - 1 - r] ?? null;
    }
  }
}

function refill(): void {
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (!grid[i]) grid[i] = randColor();
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function neighbors(a: number, b: number): boolean {
  const ar = Math.floor(a / SIZE);
  const ac = a % SIZE;
  const br = Math.floor(b / SIZE);
  const bc = b % SIZE;
  return (ar === br && Math.abs(ac - bc) === 1) || (ac === bc && Math.abs(ar - br) === 1);
}

async function trySwap(a: number, b: number): Promise<void> {
  if (busy || gameEnded) return;
  busy = true;
  const tmp = grid[a];
  grid[a] = grid[b];
  grid[b] = tmp;
  paintBoard();
  sfx.click();

  const matched = findMatches(grid);
  if (matched.size) {
    moves--;
    updateHud();
    await clearMatches();
    if (moves <= 0) endGame();
  } else {
    grid[b] = grid[a];
    grid[a] = tmp;
    sfx.slide();
    paintBoard();
  }
  selected = -1;
  busy = false;
  paintBoard();
}

async function onTileClick(i: number): Promise<void> {
  if (busy || gameEnded || !grid[i]) return;
  if (selected < 0) {
    selected = i;
    paintBoard();
    return;
  }
  if (selected === i) {
    selected = -1;
    paintBoard();
    return;
  }
  if (!neighbors(selected, i)) {
    selected = i;
    paintBoard();
    return;
  }
  const a = selected;
  selected = -1;
  await trySwap(a, i);
}

function resetGame(): void {
  score = 0;
  moves = START_MOVES;
  combo = 0;
  selected = -1;
  busy = false;
  gameEnded = false;
  fillNoMatches();
  paintBoard();
  updateHud();
}

function endGame(): void {
  if (gameEnded) return;
  gameEnded = true;
  busy = true;
  const finalScore = finalizeArcadeScore(score, Date.now() - runStart, { budgetSec: 90 });
  const isWin = finalScore >= host.winScore;
  shell.finishPlay(finalScore, isWin, '', Date.now() - runStart);
}

const shell = wireFreeCasualShell(host, beginPlay, {
  headerSlots: [
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
    { id: 'moves', labelKey: 'shell.moves', icon: 'moves' },
  ],
  onAbandon: resetGame,
});

async function beginPlay(): Promise<void> {
  runStart = Date.now();
  resetGame();
}

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
