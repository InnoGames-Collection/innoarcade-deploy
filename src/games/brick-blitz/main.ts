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
import { sfx } from '../../engine/audio';
import { BrickBlitz, W, H } from './game';
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
  syncChrome(state);
};

game.onGameOver = (score, level) => {
  if (game.state === 'levelClear') {
    $('#levelScore').textContent = `${scaleArcadeScore(score).toLocaleString()} pts`;
    return;
  }
  if (level > 5 || game.state === 'gameOver') {
    submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: 300 });
  }
};

wirePlayButtons(['nextBtn'], () => game.start());

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

wireMutePause($('#muteBtn'), $('#pauseBtn'), game, sfx);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => {
    game.render(ctx);
    scoreVal.textContent = String(scaleArcadeScore(game.score));
    levelVal.textContent = String(game.displayLevel);
    livesVal.textContent = String(game.displayLives);
  },
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
