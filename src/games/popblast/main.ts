// Candy Blast (Pop Blast) — match-3 with hub casual shell.
// Gameplay logic is FINAL — this file only adds presentation polish.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';
import { finalizeArcadeScore, match3Score, scaleArcadeScore } from '../../platform/arcadeScore';
import { pbSfx } from './audio';
import {
  initFx,
  spawnScorePopup,
  spawnParticles,
  spawnSparkles,
  showCelebration,
  screenShake,
  cameraPulse,
  tileCenter,
  CANDY_COLORS,
  celebrationText,
  celebrationTier,
  scoreLabel,
  animateCounter,
  fireworks,
  burstConfetti,
} from './fx';
import { createHud, updateHud, resetHudDisplay, getPauseBtn, setBest } from './hud';

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
let busy = false;
let gameEnded = false;
let runStart = 0;
let dragPointerId: number | null = null;
let drag: { from: number; startX: number; startY: number; dx: number; dy: number } | null = null;
let maxCombo = 0;
let totalCleared = 0;
let serverBest = 0;

const SWAP_PX = 28;

const board = $('#board');
const stage = $('#stage');

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
  board.querySelectorAll<HTMLElement>('.tile').forEach((tile) => {
    tile.style.transform = '';
    tile.style.zIndex = '';
    tile.style.transition = '';
  });
}

function applyDragVisuals(): void {
  clearDragVisuals();
  if (!drag) return;
  const from = tileEl(drag.from);
  if (!from) return;
  from.style.transition = 'transform 0.08s cubic-bezier(0.22, 1, 0.36, 1)';
  from.style.transform = `translate(${drag.dx}px, ${drag.dy}px)`;
  from.style.zIndex = '2';

  const row = Math.floor(drag.from / SIZE);
  const col = drag.from % SIZE;
  let neighbor = -1;
  if (drag.dx > SWAP_PX && col < SIZE - 1) neighbor = drag.from + 1;
  else if (drag.dx < -SWAP_PX && col > 0) neighbor = drag.from - 1;
  else if (drag.dy > SWAP_PX && row < SIZE - 1) neighbor = drag.from + SIZE;
  else if (drag.dy < -SWAP_PX && row > 0) neighbor = drag.from - SIZE;

  if (neighbor >= 0) {
    const n = tileEl(neighbor);
    if (n) {
      n.style.transition = 'transform 0.08s cubic-bezier(0.22, 1, 0.36, 1)';
      n.style.transform = `translate(${-drag.dx * 0.35}px, ${-drag.dy * 0.35}px)`;
      n.style.zIndex = '1';
    }
  }
}

function refreshHud(animate = true): void {
  updateHud({
    score: scaleArcadeScore(score),
    target: host.winScore,
    moves,
    level: 1,
    best: Math.max(serverBest, scaleArcadeScore(score)),
  }, animate);
}

function applySettleAnimation(): void {
  board.querySelectorAll<HTMLElement>('.tile:not(.empty)').forEach((tile, i) => {
    tile.classList.add('pb-settle');
    tile.style.animationDelay = `${(i % 8) * 0.02}s`;
    window.setTimeout(() => tile.classList.remove('pb-settle'), 350);
  });
}

async function clearMatches(): Promise<boolean> {
  const matched = findMatches(grid);
  if (!matched.size) return false;
  combo++;
  const matchSize = matched.size;
  const points = match3Score(matchSize, combo);
  score += points;
  totalCleared += matchSize;
  if (combo > maxCombo) maxCombo = combo;
  refreshHud();

  let cx = 0;
  let cy = 0;
  let n = 0;
  matched.forEach((i) => {
    const tile = tileEl(i);
    const color = grid[i];
    if (tile) {
      tile.classList.add('pb-pop');
      const pos = tileCenter(tile);
      cx += pos.x;
      cy += pos.y;
      n++;
      if (color) {
        spawnParticles(pos.x, pos.y, CANDY_COLORS[color], matchSize >= 4 ? 12 : 7);
        if (combo >= 2) spawnSparkles(pos.x, pos.y, 3);
      }
    }
  });

  if (n > 0) {
    cx /= n;
    cy /= n;
    spawnScorePopup(cx, cy, scoreLabel(points));
    if (combo >= 2) {
      window.setTimeout(() => spawnScorePopup(cx, cy - 28, `Combo x${combo}`, true), 80);
    }
  }

  const celeb = celebrationText(combo, matchSize);
  if (celeb) {
    const tier = celebrationTier(combo, matchSize);
    showCelebration(celeb, tier);
    if (tier === 'high') { cameraPulse(); screenShake('heavy'); }
    else if (tier === 'mid') screenShake('medium');
    else screenShake('light');
  }

  if (combo >= 2) pbSfx.combo(combo);
  else if (matchSize >= 4) pbSfx.explosion();
  else pbSfx.match(matchSize);

  await wait(160);
  matched.forEach((i) => { grid[i] = null; });
  paintBoard();
  await wait(20);
  applyGravity();
  refill();
  paintBoard();
  applySettleAnimation();
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

async function trySwap(a: number, b: number): Promise<void> {
  if (busy || gameEnded) return;
  busy = true;
  const tmp = grid[a];
  grid[a] = grid[b];
  grid[b] = tmp;
  paintBoard();
  pbSfx.swap();

  const matched = findMatches(grid);
  if (matched.size) {
    moves--;
    refreshHud();
    await clearMatches();
    if (moves <= 0) endGame();
  } else {
    grid[b] = grid[a];
    grid[a] = tmp;
    pbSfx.invalidSwap();
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
  } else {
    return;
  }
  if (to < 0 || to >= SIZE * SIZE || !grid[to]) return;
  await trySwap(from, to);
}

function resetGame(): void {
  score = 0;
  moves = START_MOVES;
  combo = 0;
  maxCombo = 0;
  totalCleared = 0;
  drag = null;
  dragPointerId = null;
  busy = false;
  gameEnded = false;
  fillNoMatches();
  paintBoard();
  resetHudDisplay();
  refreshHud(false);
}

function starsForScore(finalScore: number): number {
  const ratio = finalScore / host.winScore;
  if (ratio >= 1.5) return 3;
  if (ratio >= 1) return 2;
  if (ratio >= 0.5) return 1;
  return 0;
}

function paintResultScreen(isWin: boolean, finalScore: number): void {
  const overOverlay = $('#overOverlay');
  const titleEl = $('#fcOverTitle');
  const trophyEl = $('#pbOverTrophy');
  const comboEl = $('#pbFinalCombo');
  const clearedEl = $('#pbFinalCleared');
  const starsEl = $('#pbStars');

  overOverlay.classList.toggle('pb-victory', isWin);
  trophyEl.classList.toggle('hidden', !isWin);

  if (titleEl) {
    titleEl.textContent = isWin ? 'Victory!' : 'Game Over';
    titleEl.classList.toggle('pb-over-title--win', isWin);
  }

  if (comboEl) comboEl.textContent = String(maxCombo);
  if (clearedEl) clearedEl.textContent = String(totalCleared);

  const stars = starsForScore(finalScore);
  starsEl.querySelectorAll('.pb-star').forEach((star, i) => {
    star.classList.toggle('pb-star--lit', i < stars);
    if (i < stars) {
      (star as HTMLElement).style.animationDelay = `${i * 0.2}s`;
    }
  });

  const finalScoreEl = $('#finalScore');
  if (finalScoreEl) {
    finalScoreEl.textContent = '0';
    window.setTimeout(() => animateCounter(finalScoreEl, 0, finalScore, 1200), 300);
  }

  if (isWin) {
    window.setTimeout(() => {
      fireworks();
      burstConfetti(35);
      pbSfx.levelComplete();
    }, 400);
  } else {
    pbSfx.gameOver();
  }
}

function endGame(): void {
  if (gameEnded) return;
  gameEnded = true;
  busy = true;
  pbSfx.stopMusic();
  const finalScore = finalizeArcadeScore(score, Date.now() - runStart, { budgetSec: 90 });
  const isWin = finalScore >= host.winScore;
  paintResultScreen(isWin, finalScore);
  shell.finishPlay(finalScore, isWin, '', Date.now() - runStart);
}

const shell = wireFreeCasualShell(host, beginPlay, {
  headerSlots: [],
  pauseable: true,
  onAbandon: resetGame,
});

async function beginPlay(): Promise<void> {
  runStart = Date.now();
  resetGame();
  pbSfx.startMusic();
}

function initBackground(): void {
  const sparkles = document.getElementById('pbSparkles');
  const bubbles = document.getElementById('pbBubbles');
  if (sparkles) {
    for (let i = 0; i < 24; i++) {
      const dot = document.createElement('div');
      dot.className = 'pb-sparkle-dot';
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.top = `${Math.random() * 100}%`;
      dot.style.setProperty('--pb-dur', `${3 + Math.random() * 4}s`);
      dot.style.setProperty('--pb-delay', `${Math.random() * 3}s`);
      sparkles.appendChild(dot);
    }
    const decos = ['🍬', '🍭', '🧁', '⭐'];
    for (let i = 0; i < 6; i++) {
      const deco = document.createElement('span');
      deco.className = 'pb-candy-deco';
      deco.textContent = decos[i % decos.length];
      deco.style.left = `${8 + Math.random() * 84}%`;
      deco.style.top = `${10 + Math.random() * 80}%`;
      deco.style.setProperty('--pb-delay', `${Math.random() * 4}s`);
      sparkles.appendChild(deco);
    }
  }
  if (bubbles) {
    for (let i = 0; i < 10; i++) {
      const b = document.createElement('div');
      b.className = 'pb-bubble';
      const size = 12 + Math.random() * 28;
      b.style.width = `${size}px`;
      b.style.height = `${size}px`;
      b.style.left = `${Math.random() * 100}%`;
      b.style.bottom = `${Math.random() * 30}%`;
      b.style.setProperty('--pb-dur', `${6 + Math.random() * 6}s`);
      b.style.setProperty('--pb-delay', `${Math.random() * 5}s`);
      b.style.setProperty('--pb-drift', `${-20 + Math.random() * 40}px`);
      bubbles.appendChild(b);
    }
  }
}

function wirePresentation(): void {
  const playFrame = $('#fcPlayFrame');
  initFx(stage, playFrame);
  initBackground();
  createHud(playFrame, host.winScore, serverBest);

  getPauseBtn()?.addEventListener('click', () => {
    pbSfx.buttonClick();
    shell.pause();
  });

  document.getElementById('pbHomeBtn')?.addEventListener('click', () => {
    pbSfx.buttonClick();
    shell.goMenu();
  });

  document.getElementById('startBtn')?.addEventListener('click', () => pbSfx.menuOpen());
  document.getElementById('againBtn')?.addEventListener('click', () => pbSfx.buttonClick());

  const origRefresh = shell.refreshMenu;
  shell.refreshMenu = () => {
    origRefresh();
    const menu = document.getElementById('freeMenu');
    if (menu) {
      const bestEl = menu.querySelector('.shell-free-best');
      if (bestEl) {
        menu.innerHTML = '';
        bestEl.className = 'pb-menu-best';
        menu.appendChild(bestEl);
      } else {
        menu.innerHTML = '';
      }
    }
  };
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
board.addEventListener('pointercancel', (e) => {
  if (dragPointerId !== e.pointerId) return;
  dragPointerId = null;
  drag = null;
  clearDragVisuals();
});

document.documentElement.lang = getLang();
applyTranslations();
wirePresentation();
shell.refreshMenu();

import { freeGameBestRemote } from '../../platform/backend';
void freeGameBestRemote('popblast').then((best) => {
  serverBest = best;
  setBest(best);
  shell.refreshMenu();
});
