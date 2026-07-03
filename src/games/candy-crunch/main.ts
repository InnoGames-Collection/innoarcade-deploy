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
import { sfx } from '../../engine/audio';
import { CandyCrunch, W, H } from './game';
import {
  bindHubCanvasChrome, scaleArcadeScore, submitArcadeScore, trackArcadeRunStart,
} from '../_arcade/hubCanvas';

const GAME_ID = 'candy-crunch';
const host = new GameHost(GAME_ID);

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const playWrapper = $('#arc-play-wrapper');
const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;

const game = new CandyCrunch();
const run = trackArcadeRunStart();

const scoreVal = $('#scoreVal');
const levelVal = $('#levelVal');
const movesVal = $('#movesVal');
const goalStrip = $('#goalStrip');

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

function renderGoals(): void {
  goalStrip.innerHTML = game.goalProgress().map((g) => `
    <div class="cc-goal${g.done ? ' cc-goal-done' : ''}">
      <span class="cc-goal-emoji">${g.emoji}</span>
      <span class="cc-goal-count">${g.have}/${g.need}</span>
    </div>
  `).join('');
}

function toCanvas(e: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    ((e.clientX - rect.left) / rect.width) * W,
    ((e.clientY - rect.top) / rect.height) * H,
  ];
}

canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  const [x, y] = toCanvas(e);
  const cell = game.cellAt(x, y);
  if (cell) game.tapCell(cell.r, cell.c);
});

wireMutePause($('#muteBtn'), $('#pauseBtn'), game, sfx);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.render(ctx);
    scoreVal.textContent = String(scaleArcadeScore(game.score));
    levelVal.textContent = String(game.displayLevel);
    movesVal.textContent = `${game.movesLeft}/${game.movesTotal}`;
    renderGoals();
  },
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
