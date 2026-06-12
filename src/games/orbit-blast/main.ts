import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { sfx } from '../../engine/audio';
import { OrbitBlast, W, H, type GameState } from './game';
import {
  featuredTournament, submitScore, leaderboard, tournamentGame,
  countdown, type LeaderEntry,
} from '../../platform/tournaments';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new OrbitBlast();

const scoreVal = $('#scoreVal');
const ballsVal = $('#ballsVal');
const bestVal = $('#bestVal');
const overlays: Record<string, HTMLElement> = {
  menu: $('#menuOverlay'),
  over: $('#overOverlay'),
};

function showOverlay(state: GameState): void {
  // 'ready' and 'firing' are both in-play — no overlay.
  const key = state === 'menu' ? 'menu' : state === 'over' ? 'over' : '';
  for (const [k, el] of Object.entries(overlays)) el.classList.toggle('hidden', k !== key);
}
game.onStateChange = showOverlay;
game.onScore = (s, balls) => {
  scoreVal.textContent = String(s);
  ballsVal.textContent = '×' + balls;
};

// --- Tournament wiring ------------------------------------------------------
const tourney = featuredTournament();
const tourneyGame = tourney ? tournamentGame(tourney) : undefined;

function renderTournamentBadge(): void {
  if (!tourney) return;
  const c = countdown(tourney.endsAt);
  $('#tEnds').textContent = `${c.days}d ${c.hours}h ${c.minutes}m`;
}

function renderLeaderboard(rows: LeaderEntry[], listSel = '#leaderList'): void {
  const list = $(listSel);
  list.innerHTML = '';
  for (const r of rows) {
    const li = document.createElement('li');
    li.className = 'leader-row' + (r.isPlayer ? ' me' : '');
    li.innerHTML =
      `<span class="lr-rank">${r.rank}</span>` +
      `<span class="lr-name">${escapeHtml(r.name)}</span>` +
      `<span class="lr-score">${r.score.toLocaleString()}</span>`;
    list.appendChild(li);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

game.onGameOver = (score, record) => {
  $('#finalScore').textContent = String(score);
  $('#finalBest').textContent = String(game.best);
  $('#newBest').classList.toggle('hidden', !record);
  if (tourney) {
    const result = submitScore(tourney.id, score);
    $('#rankVal').textContent = `#${result.rank}`;
    $('#rankTotal').textContent = `/ ${result.total}`;
    // Show the player plus a window of nearby rivals.
    const board = leaderboard(tourney.id);
    const meIdx = board.findIndex((e) => e.isPlayer);
    const startN = Math.max(0, Math.min(meIdx - 2, board.length - 5));
    renderLeaderboard(board.slice(startN, startN + 5), '#leaderList2');
    $('#overTournament').classList.remove('hidden');
  }
};

// --- Pointer aiming ---------------------------------------------------------
function toCanvas(e: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    ((e.clientX - rect.left) / rect.width) * W,
    ((e.clientY - rect.top) / rect.height) * H,
  ];
}

let aiming = false;
canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'ready') return;
  aiming = true;
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = toCanvas(e);
  game.setAim(x, y);
});
canvas.addEventListener('pointermove', (e) => {
  if (!aiming) return;
  const [x, y] = toCanvas(e);
  game.setAim(x, y);
});
canvas.addEventListener('pointerup', () => {
  if (!aiming) return;
  aiming = false;
  game.release();
});

$('#startBtn').addEventListener('click', () => game.start());
$('#againBtn').addEventListener('click', () => game.start());

const muteBtn = $('#muteBtn');
muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
muteBtn.addEventListener('click', () => {
  muteBtn.textContent = sfx.toggleMute() ? '🔇' : '🔊';
});

const langEn = $('#langEn');
const langAm = $('#langAm');
function syncLangButtons(): void {
  const lang = getLang();
  langEn.classList.toggle('active', lang === 'en');
  langAm.classList.toggle('active', lang === 'am');
  renderTournamentBadge();
}
function pick(lang: Lang): void { setLang(lang); syncLangButtons(); }
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

// Populate the menu's tournament strip.
if (tourney && tourneyGame) {
  $('#tName').textContent = `${t('hub.monthly')} · ${getLang() === 'am' ? tourneyGame.nameAm : tourneyGame.nameEn}`;
  renderLeaderboard(leaderboard(tourney.id, 3));
  renderTournamentBadge();
} else {
  $('#menuTournament').classList.add('hidden');
}

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => {
    game.render(ctx);
    bestVal.textContent = String(game.best);
  },
);

document.documentElement.lang = getLang();
applyTranslations();
syncLangButtons();
showOverlay('menu');
loop.start();
