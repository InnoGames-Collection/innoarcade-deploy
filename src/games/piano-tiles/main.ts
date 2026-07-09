// Piano Tiles — tap black tiles only; speed ramps over 60 seconds. Native GoPlay game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_shared/premiumGems.css';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';
import { showFirstRunHint } from '../_shared/firstRun';
import { gemClassesByIndex } from '../_shared/premiumGems';

const COLS = 4;
const SESSION_SEC = 60;
const BASE_SPEED = 180;
const host = createHost('piano-tiles');

interface Tile {
  col: number;
  y: number;
  el: HTMLElement;
  hit: boolean;
  decoy?: boolean;
}

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const lanesEl = $('#pt-lanes');
const message = $('#pt-message');

let tiles: Tile[] = [];
let score = 0;
let combo = 0;
let speed = BASE_SPEED;
let playing = false;
let runStart = 0;
let spawnAcc = 0;
let spawnGap = 0.55;
let rafId = 0;
let lastTs = 0;
let laneEls: HTMLElement[] = [];

function displayScore(): number {
  return score * 10 + combo * 2;
}

function updateHud(): void {
  const left = Math.max(0, SESSION_SEC - Math.floor((Date.now() - runStart) / 1000));
  shell.setHeader({ time: String(left), score: String(displayScore()) });
}

function resetField(): void {
  cancelAnimationFrame(rafId);
  tiles.forEach((t) => t.el.remove());
  tiles = [];
  score = 0;
  combo = 0;
  speed = BASE_SPEED;
  spawnAcc = 0;
  spawnGap = 0.55;
  playing = false;
  message.textContent = '';
  lanesEl.innerHTML = '';
  laneEls = [];
  for (let c = 0; c < COLS; c++) {
    const lane = document.createElement('div');
    lane.className = 'pt-lane';
    lane.dataset.col = String(c);
    lane.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onLaneTap(c);
    });
    lanesEl.appendChild(lane);
    laneEls.push(lane);
  }
  updateHud();
}

function spawnRow(): void {
  const col = Math.floor(Math.random() * COLS);
  const tileEl = document.createElement('div');
  tileEl.className = `pt-tile ${gemClassesByIndex(col, 'block')}`;
  tileEl.style.top = '-76px';
  laneEls[col].appendChild(tileEl);
  tiles.push({ col, y: -76, el: tileEl, hit: false });
  for (let c = 0; c < COLS; c++) {
    if (c === col) continue;
    const ghost = document.createElement('div');
    ghost.className = `pt-tile pt-decoy ${gemClassesByIndex(c, 'block')} pgem--preview`;
    ghost.style.top = '-76px';
    ghost.style.pointerEvents = 'none';
    laneEls[c].appendChild(ghost);
    tiles.push({ col: c, y: -76, el: ghost, hit: true, decoy: true });
  }
}

function onLaneTap(col: number): void {
  if (!playing) return;
  const laneH = lanesEl.clientHeight || 400;
  const hitZone = laneH - 88;
  const candidates = tiles.filter((t) => t.col === col && !t.hit && !t.decoy && t.y >= hitZone - 40 && t.y <= hitZone + 40);
  if (candidates.length === 0) {
    const wrong = tiles.some((t) => t.col === col && t.decoy && !t.hit && t.y >= hitZone - 50 && t.y <= hitZone + 50);
    gameOver(wrong ? 'Wrong tile!' : 'Miss!');
    return;
  }
  const tile = candidates.sort((a, b) => b.y - a.y)[0];
  tile.hit = true;
  tile.el.classList.add('pt-hit');
  score++;
  combo++;
  sfx.click();
  setTimeout(() => tile.el.remove(), 80);
  updateHud();
}

function gameOver(reason: string): void {
  if (!playing) return;
  playing = false;
  cancelAnimationFrame(rafId);
  message.textContent = reason;
  sfx.crash();
  const final = displayScore();
  const isWin = final >= host.winScore;
  if (isWin) sfx.coin();
  shell.finishPlay(final, isWin, `${score} tiles · ${reason}`, Date.now() - runStart);
}

function tick(ts: number): void {
  if (!playing) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  const laneH = lanesEl.clientHeight || 400;
  const missLine = laneH + 20;

  spawnAcc += dt;
  if (spawnAcc >= spawnGap) {
    spawnAcc = 0;
    spawnRow();
    spawnGap = Math.max(0.28, spawnGap - 0.004);
    speed = Math.min(420, speed + 2);
  }

  for (const tile of tiles) {
    if (tile.decoy) {
      tile.y += speed * dt;
      tile.el.style.top = `${tile.y}px`;
      if (tile.y > missLine) tile.el.remove();
      continue;
    }
    if (tile.hit) continue;
    tile.y += speed * dt;
    tile.el.style.top = `${tile.y}px`;
    if (tile.y > missLine) {
      gameOver('Tile missed!');
      return;
    }
  }
  tiles = tiles.filter((t) => t.el.isConnected);

  const elapsed = (Date.now() - runStart) / 1000;
  if (elapsed >= SESSION_SEC) {
    playing = false;
    cancelAnimationFrame(rafId);
    const final = displayScore();
    sfx.coin();
    message.textContent = `Time! ${score} tiles`;
    shell.finishPlay(final, final >= host.winScore, `${score} tiles in ${SESSION_SEC}s`, Date.now() - runStart);
    return;
  }
  updateHud();
  rafId = requestAnimationFrame(tick);
}

const shell = wireFreeCasualShell(host, startGame, {
  pauseable: false,
  onAbandon: resetField,
  headerSlots: [
    { id: 'time', labelKey: 'tg.time', icon: 'time' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});

async function startGame(): Promise<void> {
  resetField();
  sfx.click();
  playing = true;
  runStart = Date.now();
  lastTs = performance.now();
  showFirstRunHint('piano-tiles', (m) => {
    message.textContent = m;
    window.setTimeout(() => { if (playing) message.textContent = 'Tap the black tiles!'; }, 5000);
  });
  if (!message.textContent) message.textContent = 'Tap the black tiles!';
  updateHud();
  rafId = requestAnimationFrame(tick);
}

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
