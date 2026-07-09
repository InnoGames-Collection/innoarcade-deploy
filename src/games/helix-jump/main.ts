import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_arcade/hubCanvas.css';
import './style.css';
import { GameHost } from '../../platform/gameHost';
import { standardStateOverlay, wireFreeEngineMain, wireMutePause } from '../../platform/freeGameShell';
import { applyTranslations, getLang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { HelixJump, W, H, claimDailyReward } from './game';
import { bindHubCanvasChrome, scaleArcadeScore, submitArcadeScore, trackArcadeRunStart } from '../_arcade/hubCanvas';
import { loadSave, toggleMusic, toggleVibrate } from './saveData';

const GAME_ID = 'helix-jump';
const host = new GameHost(GAME_ID);
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const playWrapper = $('#arc-play-wrapper');
const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
ctx.imageSmoothingEnabled = true;

const game = new HelixJump();
const run = trackArcadeRunStart(GAME_ID);

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
game.onStateChange = (s) => { run.onStateChange(s); syncChrome(s); };
game.onGameOver = (score) => {
  submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: 120, gameId: GAME_ID, winScore: host.winScore });
};

const input = new Input(canvas);
input.onAction((a) => game.handleAction(a));
wireMutePause($('#muteBtn'), $('#pauseBtn'), game, sfx);

const musicBtn = document.getElementById('musicBtn');
if (musicBtn) {
  const save = loadSave();
  musicBtn.textContent = save.musicOn ? '🎵' : '🎵';
  musicBtn.setAttribute('aria-pressed', save.musicOn ? 'true' : 'false');
  musicBtn.addEventListener('click', () => {
    const on = toggleMusic();
    musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    musicBtn.classList.toggle('hx-muted', !on);
  });
}

const vibeBtn = document.getElementById('vibeBtn');
if (vibeBtn) {
  const save = loadSave();
  vibeBtn.setAttribute('aria-pressed', save.vibrateOn ? 'true' : 'false');
  vibeBtn.addEventListener('click', () => {
    const on = toggleVibrate();
    vibeBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    vibeBtn.classList.toggle('hx-muted', !on);
  });
}

document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

let dragX: number | null = null;
canvas.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest('button')) return;
  dragX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (dragX === null) return;
  const dx = e.clientX - dragX;
  if (Math.abs(dx) > 0.5) game.onDrag(dx);
  dragX = e.clientX;
});
canvas.addEventListener('pointerup', () => { dragX = null; });
canvas.addEventListener('pointercancel', () => { dragX = null; });

const scoreEl = $('#scoreVal');
let lastScore = 0;
const loop = new GameLoop(
  (dt) => game.update(dt),
  () => {
    game.render(ctx);
    const scaled = scaleArcadeScore(game.score);
    scoreEl.textContent = String(scaled);
    if (scaled !== lastScore) {
      lastScore = scaled;
      scoreEl.classList.remove('hx-score-pop');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('hx-score-pop');
    }
  },
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');

const daily = claimDailyReward();
if (daily > 0) {
  const menu = $('#freeMenu');
  const note = document.createElement('p');
  note.className = 'hx-daily-reward';
  note.textContent = `+${daily} coins daily reward`;
  menu.prepend(note);
}

loop.start();
