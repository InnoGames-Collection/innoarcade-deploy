import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_arcade/hubCanvas.css';
import { GameHost } from '../../platform/gameHost';
import {
  standardStateOverlay, wireFreeEngineMain, wireMutePause, wirePlayButtons,
} from '../../platform/freeGameShell';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { BrickBlitz, W, H } from './game';
import { bbSfx } from './bbAudio';
import {
  bindHubCanvasChrome, scaleArcadeScore, submitArcadeScore, trackArcadeRunStart,
} from '../_arcade/hubCanvas';

const GAME_ID = 'brick-blitz';
const host = new GameHost(GAME_ID);

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const playWrapper = $('#arc-play-wrapper');
const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new BrickBlitz();
const run = trackArcadeRunStart();

const scoreVal = $('#scoreVal');
const levelVal = $('#levelVal');
const livesVal = $('#livesVal');
const comboVal = $('#comboVal');
const comboCard = $('#comboCard');
const bestVal = $('#bestVal');
const scoreCard = scoreVal.closest('.bb-hud-card') as HTMLElement;

let displayedScore = 0;
let lastCombo = 0;

bestVal.textContent = String(scaleArcadeScore(game.best));

const shell = wireFreeEngineMain({
  host,
  overlays: {
    menu: $('#menuOverlay'),
    paused: $('#pauseOverlay'),
    levelClear: $('#levelClearOverlay'),
    over: $('#overOverlay'),
  },
  stateOverlay: standardStateOverlay,
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
  getDurationMs: () => Date.now() - run.getRunStart(),
});

const syncChrome = bindHubCanvasChrome({
  playWrapper,
  backdrop: $('#fcBackdrop'),
  shell,
});

game.onStateChange = (state) => {
  run.onStateChange(state);
  shell.showForState(state);
  syncChrome(state);
};

game.onGameOver = (score, level) => {
  if (game.state === 'levelClear') {
    $('#levelScore').textContent = `${scaleArcadeScore(score).toLocaleString()} pts`;
    return;
  }
  if (level > 5 || game.state === 'gameOver') {
    submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: 300 });
    setTimeout(() => populateGameOverStats(), 50);
  }
};

function populateGameOverStats(): void {
  $('#statCombo').textContent = `${game.highestCombo}×`;
  $('#statAccuracy').textContent = `${game.accuracy}%`;
  $('#statBricks').textContent = String(game.bricksDestroyed);
  const finalEl = $('#finalScore');
  const target = parseInt(finalEl.textContent?.replace(/,/g, '') || '0', 10);
  animateCount(finalEl, 0, target, 1200);
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
  card.classList.remove('bb-pop');
  void card.offsetWidth;
  card.classList.add('bb-pop');
  setTimeout(() => card.classList.remove('bb-pop'), 300);
}

wirePlayButtons(['nextBtn'], () => {
  bbSfx.click();
  game.start();
});

$('#startBtn').addEventListener('click', () => bbSfx.click());
$('#againBtn').addEventListener('click', () => bbSfx.click());
$('#resumeBtn').addEventListener('click', () => bbSfx.click());
$('#restartBtn').addEventListener('click', () => bbSfx.click());

function toCanvas(e: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    ((e.clientX - rect.left) / rect.width) * W,
    ((e.clientY - rect.top) / rect.height) * H,
  ];
}

canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  canvas.setPointerCapture(e.pointerId);
  const [x] = toCanvas(e);
  game.setPaddleX(x);
  game.launchBall();
});

canvas.addEventListener('pointermove', (e) => {
  if (game.state !== 'playing') return;
  const [x] = toCanvas(e);
  game.setPaddleX(x);
  game.releasePaddle();
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd') {
    game.releasePaddle();
  }
});

const input = new Input(document.body);
input.onAction((a) => {
  if (a === 'left') game.handleAction('left');
  else if (a === 'right') game.handleAction('right');
  else if (a === 'tap') game.launchBall();
  else if (a === 'pause') {
    if (game.state === 'playing') game.pause();
    else if (game.state === 'paused') game.resume();
  }
});

wireMutePause($('#muteBtn'), $('#pauseBtn'), game, bbSfx);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => {
    game.render(ctx);

    const target = scaleArcadeScore(game.score);
    if (displayedScore !== target) {
      const diff = target - displayedScore;
      const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.15));
      displayedScore += diff > 0 ? step : -step;
      if (Math.abs(target - displayedScore) < step) displayedScore = target;
      scoreVal.textContent = displayedScore.toLocaleString();
      if (diff > 0) popCard(scoreCard);
    }

    levelVal.textContent = String(game.displayLevel);
    livesVal.textContent = String(game.displayLives);
    bestVal.textContent = String(scaleArcadeScore(game.best));

    if (game.displayCombo !== lastCombo) {
      lastCombo = game.displayCombo;
      comboVal.textContent = game.displayCombo > 1 ? `${game.displayCombo}×` : '—';
      comboCard.classList.toggle('bb-combo-hot', game.displayCombo >= 3);
      comboCard.classList.toggle('bb-combo-fire', game.displayCombo >= 5);
      comboCard.classList.toggle('bb-combo-gold', game.displayCombo >= 10);
      if (game.displayCombo > 1) popCard(comboCard);
    }
  },
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
