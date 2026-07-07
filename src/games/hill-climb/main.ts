import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_arcade/hubCanvas.css';
import { GameHost } from '../../platform/gameHost';
import { standardStateOverlay, wireFreeEngineMain, wireMutePause } from '../../platform/freeGameShell';
import { applyTranslations, getLang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { sfx } from '../../engine/audio';
import { HillClimb, W, H } from './game';
import { bindHubCanvasChrome, scaleArcadeScore, submitArcadeScore, trackArcadeRunStart } from '../_arcade/hubCanvas';

const host = new GameHost('hill-climb');
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const playWrapper = $('#arc-play-wrapper');
const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new HillClimb();
const run = trackArcadeRunStart();

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

const syncChrome = bindHubCanvasChrome({ playWrapper, backdrop: $('#fcBackdrop'), shell });
game.onStateChange = (s) => { run.onStateChange(s); syncChrome(s); };
game.onGameOver = (score) => { submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: 120 }); };

function toCanvas(e: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H];
}

canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  const [, y] = toCanvas(e);
  if (y > H - 72) {
    const [, x] = toCanvas(e);
    if (x < W / 2) { game.setGas(true); sfx.click(); }
    else { game.setBrake(true); }
  } else {
    game.setGas(true);
    sfx.click();
  }
});
canvas.addEventListener('pointerup', () => { game.setGas(false); game.setBrake(false); });
canvas.addEventListener('pointercancel', () => { game.setGas(false); game.setBrake(false); });

wireMutePause($('#muteBtn'), $('#pauseBtn'), game, sfx);
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => { game.render(ctx); $('#scoreVal').textContent = String(scaleArcadeScore(game.score)); },
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
