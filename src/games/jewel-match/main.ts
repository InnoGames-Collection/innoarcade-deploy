import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';
import { finalizeArcadeScore, match3Score, scaleArcadeScore } from '../../platform/arcadeScore';

const host = createHost('jewel-match');
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const SIZE = 8;
const COLORS = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'diamond'] as const;
type Color = typeof COLORS[number];
const START_MOVES = 25;

let grid: (Color | null)[] = [];
let score = 0;
let moves = START_MOVES;
let combo = 0;
let busy = false;
let gameEnded = false;
let runStart = 0;
let dragPointerId: number | null = null;
let drag: { from: number; startX: number; startY: number; dx: number; dy: number } | null = null;

const SWAP_PX = 28;
const board = $('#board');
const comboEl = $('#combo');

function idx(r: number, c: number): number { return r * SIZE + c; }

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
  do { grid = Array.from({ length: SIZE * SIZE }, () => randColor()); }
  while (findMatches(grid).size > 0);
}

function paintBoard(): void {
  board.innerHTML = '';
  grid.forEach((color, i) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile' + (color ? ` ${color}` : ' empty');
    tile.dataset.i = String(i);
    tile.disabled = busy || gameEnded || !color;
    board.appendChild(tile);
  });
  applyDragVisuals();
}

function tileEl(i: number): HTMLElement | null {
  return board.querySelector<HTMLElement>(`.tile[data-i="${i}"]`);
}

function clearDragVisuals(): void {
  board.querySelectorAll<HTMLElement>('.tile').forEach((t) => { t.style.transform = ''; t.style.zIndex = ''; });
}

function applyDragVisuals(): void {
  clearDragVisuals();
  if (!drag) return;
  const from = tileEl(drag.from);
  if (!from) return;
  from.style.transform = `translate(${drag.dx}px, ${drag.dy}px)`;
  from.style.zIndex = '2';
}

function updateHud(): void {
  shell.setHeader({ score: String(scaleArcadeScore(score)), moves: String(moves) });
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
  for (let c = 0; c < SIZE; c++) {
    const col: (Color | null)[] = [];
    for (let r = SIZE - 1; r >= 0; r--) { const v = grid[idx(r, c)]; if (v) col.push(v); }
    for (let r = SIZE - 1; r >= 0; r--) grid[idx(r, c)] = col[SIZE - 1 - r] ?? null;
  }
  for (let i = 0; i < SIZE * SIZE; i++) if (!grid[i]) grid[i] = randColor();
  paintBoard();
  await wait(120);
  if (findMatches(grid).size) await clearMatches();
  else combo = 0;
  return true;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function trySwap(a: number, b: number): Promise<void> {
  if (busy || gameEnded) return;
  busy = true;
  const tmp = grid[a]; grid[a] = grid[b]; grid[b] = tmp;
  paintBoard();
  sfx.click();
  if (findMatches(grid).size) {
    moves--;
    updateHud();
    await clearMatches();
    if (moves <= 0) endGame();
  } else {
    grid[b] = grid[a]; grid[a] = tmp;
    sfx.slide();
    paintBoard();
  }
  busy = false;
  paintBoard();
}

async function endDrag(): Promise<void> {
  if (!drag) return;
  const { from, dx, dy } = drag;
  drag = null;
  clearDragVisuals();
  const row = Math.floor(from / SIZE);
  const col = from % SIZE;
  let to = -1;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWAP_PX) {
    to = from + (dx > 0 ? 1 : -1);
    if (Math.floor(to / SIZE) !== row) return;
  } else if (Math.abs(dy) > SWAP_PX) {
    to = from + (dy > 0 ? SIZE : -SIZE);
    if (to < 0 || to >= SIZE * SIZE || to % SIZE !== col) return;
  } else return;
  if (to < 0 || to >= SIZE * SIZE || !grid[to]) return;
  await trySwap(from, to);
}

function resetGame(): void {
  score = 0; moves = START_MOVES; combo = 0;
  drag = null; dragPointerId = null; busy = false; gameEnded = false;
  fillNoMatches();
  paintBoard();
  updateHud();
}

function endGame(): void {
  if (gameEnded) return;
  gameEnded = true;
  busy = true;
  const finalScore = finalizeArcadeScore(score, Date.now() - runStart, { budgetSec: 90 });
  shell.finishPlay(finalScore, finalScore >= host.winScore, '', Date.now() - runStart);
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

board.addEventListener('pointerdown', (e) => {
  if (busy || gameEnded) return;
  const tile = (e.target as HTMLElement).closest('.tile') as HTMLButtonElement | null;
  if (!tile || tile.disabled) return;
  const from = Number(tile.dataset.i);
  if (!grid[from]) return;
  dragPointerId = e.pointerId;
  board.setPointerCapture(e.pointerId);
  drag = { from, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 };
});

board.addEventListener('pointermove', (e) => {
  if (!drag || dragPointerId !== e.pointerId) return;
  let dx = e.clientX - drag.startX;
  let dy = e.clientY - drag.startY;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  const max = 52;
  drag.dx = Math.max(-max, Math.min(max, dx));
  drag.dy = Math.max(-max, Math.min(max, dy));
  applyDragVisuals();
});

function releaseDrag(e: PointerEvent): void {
  if (dragPointerId !== e.pointerId) return;
  dragPointerId = null;
  try { board.releasePointerCapture(e.pointerId); } catch { /* released */ }
  void endDrag();
}

board.addEventListener('pointerup', releaseDrag);
board.addEventListener('pointercancel', () => { dragPointerId = null; drag = null; clearDragVisuals(); });

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
