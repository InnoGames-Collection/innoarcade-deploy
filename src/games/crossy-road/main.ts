import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_arcade/hubCanvas.css';
import { GameHost } from '../../platform/gameHost';
import { standardStateOverlay, wireFreeEngineMain, wireMutePause } from '../../platform/freeGameShell';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { CrossyRoad, W, H } from './game';
import {
  bindHubCanvasChrome, scaleArcadeScore, submitArcadeScore, trackArcadeRunStart,
} from '../_arcade/hubCanvas';

const GAME_ID = 'crossy-road';
const host = new GameHost(GAME_ID);
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const playWrapper = $('#arc-play-wrapper');
const canvasWrap = $('.arc-canvas-wrap');
const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function currentDpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function applyCanvasBackingStore(): void {
  const dpr = currentDpr();
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fitCanvas(): void {
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  if (w <= 0 || h <= 0) return;
  const aspect = W / H;
  let cw = w;
  let ch = w / aspect;
  if (ch > h) {
    ch = h;
    cw = h * aspect;
  }
  canvas.style.width = `${Math.floor(cw)}px`;
  canvas.style.height = `${Math.floor(ch)}px`;
}

function onViewportChange(): void {
  applyCanvasBackingStore();
  fitCanvas();
}

applyCanvasBackingStore();
fitCanvas();
window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => fitCanvas());
  ro.observe(canvasWrap);
  ro.observe(playWrapper);
}

const game = new CrossyRoad();
const run = trackArcadeRunStart(GAME_ID);
const scoreVal = $('#scoreVal');

const shell = wireFreeEngineMain({
  host,
  overlays: { menu: $('#menuOverlay'), paused: $('#pauseOverlay'), over: $('#overOverlay') },
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

const syncChrome = bindHubCanvasChrome({ playWrapper, backdrop: $('#fcBackdrop'), shell, gameId: GAME_ID, skipFirstRun: true });

game.onStateChange = (state) => {
  run.onStateChange(state);
  syncChrome(state);
  if (state === 'playing') requestAnimationFrame(fitCanvas);
};
game.onGameOver = (score) => { submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: 90, gameId: GAME_ID, winScore: host.winScore }); };

const input = new Input(canvas);
input.onAction((a) => {
  if (a === 'pause') {
    if (game.state === 'playing') game.pause();
    else if (game.state === 'paused') game.resume();
    return;
  }
  game.handleAction(a);
});

wireMutePause($('#muteBtn'), $('#pauseBtn'), game, sfx);
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => {
    game.render(ctx);
    scoreVal.textContent = String(scaleArcadeScore(game.score));
  },
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
