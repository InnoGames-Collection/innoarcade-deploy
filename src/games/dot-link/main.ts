import '../../styles/base.css';
import '../../styles/game-shell.css';
import { GameHost } from '../../platform/gameHost';
import {
  standardStateOverlay, wireFreeEngineMain, wireMutePause, wirePlayButtons,
} from '../../platform/freeGameShell';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { DotLink, W, H } from './game';

const GAME_ID = 'dot-link';
const host = new GameHost(GAME_ID);

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new DotLink();

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
});

game.onStateChange = shell.showForState;

game.onGameOver = (score, level, record) => {
  if (level > 5) {
    void shell.handleGameOver(score, record);
  } else {
    $('#levelScore').textContent = `Level Score: ${score}`;
  }
};

wirePlayButtons(['nextBtn'], () => game.start());

const input = new Input(document.body);
input.onAction((a) => {
  if (a === 'pause') {
    if (game.state === 'playing') game.pause();
    else if (game.state === 'paused') game.resume();
    return;
  }
  game.handleAction(a);
});

let isDrawing = false;
canvas.addEventListener('pointerdown', (e) => {
  isDrawing = true;
  game.startDrawing(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  if (isDrawing) game.continueDrawing(e.clientX, e.clientY);
});
canvas.addEventListener('pointerup', () => {
  if (isDrawing) game.endDrawing();
  isDrawing = false;
});
canvas.addEventListener('pointercancel', () => {
  isDrawing = false;
});

wireMutePause($('#muteBtn'), $('#pauseBtn'), game, sfx);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => game.render(ctx),
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
