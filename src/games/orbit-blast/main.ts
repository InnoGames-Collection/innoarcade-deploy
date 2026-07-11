import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_arcade/hubCanvas.css';
import { GameHost } from '../../platform/gameHost';
import {
  wireFreeEngineMain, wireMutePause, wirePlayButtons,
} from '../../platform/freeGameShell';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { OrbitBlast, W, H } from './game';
import { obSfx } from './obAudio';
import {
  bindHubCanvasChrome, scaleArcadeScore, submitArcadeScore, trackArcadeRunStart,
} from '../_arcade/hubCanvas';

const GAME_ID = 'orbit-blast';
const host = new GameHost(GAME_ID);

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const playWrapper = $('#arc-play-wrapper');
const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new OrbitBlast();
const run = trackArcadeRunStart();

const scoreVal = $('#scoreVal');
const ballsVal = $('#ballsVal');
const levelVal = $('#levelVal');
const bestVal = $('#bestVal');
const comboVal = $('#comboVal');
const comboCard = $('#comboCard');
const scoreCard = $('#scoreCard');

let displayedScore = 0;
let lastCombo = 0;

bestVal.textContent = String(scaleArcadeScore(game.best));

function orbitStateOverlay(state: string): string | null {
  if (state === 'menu') return 'menu';
  if (state === 'over') return 'over';
  if (state === 'paused') return 'paused';
  if (state === 'ready' || state === 'firing') return null;
  return state;
}

const shell = wireFreeEngineMain({
  host,
  overlays: { menu: $('#menuOverlay'), paused: $('#pauseOverlay'), over: $('#overOverlay') },
  stateOverlay: orbitStateOverlay,
  hud: $('#hud'),
  closeBtn: $('#closeBtn'),
  freeMenu: $('#freeMenu'),
  startBtn: $('#startBtn'),
  againBtn: $('#againBtn'),
  restartBtn: $('#restartBtn'),
  resumeBtn: $('#resumeBtn'),
  finalScore: $('#finalScore'),
  finalBest: $('#finalBest'),
  newBest: $('#newBest'),
  runReward: $('#runReward'),
  game,
  formatScore: (s) => scaleArcadeScore(s).toLocaleString(),
  getDurationMs: () => Date.now() - run.getRunStart(),
});

const syncChrome = bindHubCanvasChrome({
  playWrapper,
  backdrop: $('#fcBackdrop'),
  shell,
});

game.onStateChange = (state) => {
  run.onStateChange(state);
  syncChrome(state);
  shell.showForState(state);
};

game.onScore = (_s, balls) => {
  ballsVal.textContent = '×' + balls;
  levelVal.textContent = String(game.displayLevel);
};

game.onGameOver = (score) => {
  submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: 180 });
  setTimeout(() => populateGameOverStats(), 50);
};

function populateGameOverStats(): void {
  $('#statCombo').textContent = `${game.highestCombo}×`;
  $('#statAccuracy').textContent = `${game.accuracy}%`;
  $('#statBlocks').textContent = String(game.blocksDestroyed);
  const finalEl = $('#finalScore');
  const target = parseInt(finalEl.textContent?.replace(/,/g, '') || '0', 10);
  animateCount(finalEl, 0, target, 1400);
}

function animateCount(el: HTMLElement, from: number, to: number, duration: number): void {
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function popCard(card: HTMLElement): void {
  card.classList.remove('ob-pop');
  void card.offsetWidth;
  card.classList.add('ob-pop');
  setTimeout(() => card.classList.remove('ob-pop'), 300);
}

wirePlayButtons(['startBtn'], () => obSfx.click());
$('#againBtn').addEventListener('click', () => obSfx.click());
$('#resumeBtn').addEventListener('click', () => obSfx.click());
$('#restartBtn').addEventListener('click', () => obSfx.click());

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

wireMutePause($('#muteBtn'), null, game, obSfx);

$('#pauseBtn').addEventListener('click', () => {
  if (game.state === 'ready' || game.state === 'firing') {
    game.pause();
    shell.showForState('paused');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (game.state === 'ready' || game.state === 'firing')) {
    game.pause();
    shell.showForState('paused');
  }
});

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => {
    game.render(ctx);

    const target = scaleArcadeScore(game.score);
    if (displayedScore !== target) {
      const diff = target - displayedScore;
      const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.18));
      displayedScore += diff > 0 ? step : -step;
      if (Math.abs(target - displayedScore) < step) displayedScore = target;
      scoreVal.textContent = displayedScore.toLocaleString();
      if (diff > 0) popCard(scoreCard);
    }

    levelVal.textContent = String(game.displayLevel);
    bestVal.textContent = String(scaleArcadeScore(Math.max(game.best, game.score)));

    if (game.displayCombo !== lastCombo) {
      lastCombo = game.displayCombo;
      comboVal.textContent = game.displayCombo > 1 ? `${game.displayCombo}×` : '—';
      comboCard.classList.toggle('ob-combo-hot', game.displayCombo >= 3);
      comboCard.classList.toggle('ob-combo-fire', game.displayCombo >= 5);
      comboCard.classList.toggle('ob-combo-gold', game.displayCombo >= 10);
      if (game.displayCombo > 1) popCard(comboCard);
    }
  },
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
