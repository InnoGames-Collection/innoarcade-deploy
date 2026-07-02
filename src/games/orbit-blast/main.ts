import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_arcade/hubCanvas.css';
import { GameHost } from '../../platform/gameHost';
import {
  wireFreeEngineMain, wireMutePause,
} from '../../platform/freeGameShell';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { sfx } from '../../engine/audio';
import { OrbitBlast, W, H } from './game';
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

function orbitStateOverlay(state: string): string | null {
  if (state === 'menu') return 'menu';
  if (state === 'over') return 'over';
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
game.onScore = (s, balls) => {
  scoreVal.textContent = String(scaleArcadeScore(s));
  ballsVal.textContent = '×' + balls;
};
game.onGameOver = (score) => {
  submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: 180 });
};

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

wireMutePause($('#muteBtn'), null, game, sfx);

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => game.render(ctx),
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
