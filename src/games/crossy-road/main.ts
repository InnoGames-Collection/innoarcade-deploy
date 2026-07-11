import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_arcade/hubCanvas.css';
import { GameHost } from '../../platform/gameHost';
import { standardStateOverlay, wireFreeEngineMain, wireMutePause } from '../../platform/freeGameShell';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { crossyRoadAudio } from './crossyRoadAudio';
import { getMaxDpr, reportFrameTime } from './render/quality';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { CrossyRoad, W, H, type GameState } from './game';
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
  return Math.min(window.devicePixelRatio || 1, getMaxDpr());
}

let appliedDpr = currentDpr();

function applyCanvasBackingStore(): void {
  const dpr = currentDpr();
  if (dpr === appliedDpr && canvas.width === Math.round(W * dpr)) return;
  appliedDpr = dpr;
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
const coinVal = $('#coinVal');
const scoreStat = scoreVal.closest('.fp-stat-score') as HTMLElement | null;
const coinStat = coinVal.closest('.fp-stat-coins') as HTMLElement | null;
let lastScore = 0;
let lastCoins = 0;

function bumpScoreHud(): void {
  if (!scoreStat) return;
  scoreStat.classList.remove('cr-score-bump');
  void scoreStat.offsetWidth;
  scoreStat.classList.add('cr-score-bump');
  window.setTimeout(() => scoreStat.classList.remove('cr-score-bump'), 320);
}

function bumpCoinHud(): void {
  if (!coinStat) return;
  coinStat.classList.remove('cr-coin-bump');
  void coinStat.offsetWidth;
  coinStat.classList.add('cr-coin-bump');
  window.setTimeout(() => coinStat.classList.remove('cr-coin-bump'), 320);
}

function syncAudio(state: GameState): void {
  if (state === 'playing') crossyRoadAudio.startSession();
  else crossyRoadAudio.stopSession();
}

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

const syncChrome = bindHubCanvasChrome({ playWrapper, backdrop: $('#fcBackdrop'), shell, gameId: GAME_ID });

game.onStateChange = (state) => {
  run.onStateChange(state);
  syncChrome(state);
  syncAudio(state);
  if (state === 'playing') {
    requestAnimationFrame(fitCanvas);
    lastScore = game.score;
    lastCoins = game.coins;
  }
};
game.onGameOver = (score, record) => {
  if (record) crossyRoadAudio.newBest();
  const finalCoins = document.getElementById('finalCoins');
  if (finalCoins) finalCoins.textContent = String(game.coins);
  submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: 90, gameId: GAME_ID, winScore: host.winScore });
};

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
  (dt) => {
    if (game.state === 'playing') reportFrameTime(dt);
    game.update(dt);
  },
  () => {
    applyCanvasBackingStore();
    game.render(ctx);
    const scaled = scaleArcadeScore(game.score);
    scoreVal.textContent = String(scaled);
    coinVal.textContent = String(game.coins);
    if (game.state === 'playing' && game.score > lastScore) {
      bumpScoreHud();
      lastScore = game.score;
    }
    if (game.state === 'playing' && game.coins > lastCoins) {
      bumpCoinHud();
      lastCoins = game.coins;
    }
  },
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
