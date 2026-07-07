import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_arcade/hubCanvas.css';
import { GameHost } from '../../platform/gameHost';
import { standardStateOverlay, wireFreeEngineMain, wireMutePause } from '../../platform/freeGameShell';
import { applyTranslations, getLang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { sfx } from '../../engine/audio';
import { TowerDefense, W, H } from './game';
import { bindHubCanvasChrome, scaleArcadeScore, submitArcadeScore, trackArcadeRunStart } from '../_arcade/hubCanvas';

const GAME_ID = 'tower-defense';
const host = new GameHost(GAME_ID);
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const playWrapper = $('#arc-play-wrapper');
const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new TowerDefense();
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
game.onGameOver = (score) => { submitArcadeScore(score, run.getRunStart(), shell, { budgetSec: 180, gameId: GAME_ID, winScore: host.winScore }); };

function toCanvas(e: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H];
}

canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = toCanvas(e);
  if (y > H - 88) {
    game.setTowerType(x < W / 2 ? 0 : 1);
    return;
  }
  game.handleTap(x, y);
});

wireMutePause($('#muteBtn'), $('#pauseBtn'), game, sfx);
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => {
    game.render(ctx);
    $('#scoreVal').textContent = String(scaleArcadeScore(game.score));
    $('#waveVal').textContent = String(game.wave);
    $('#livesVal').textContent = String(game.lives);
  },
);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
shell.showForState('menu');
loop.start();
