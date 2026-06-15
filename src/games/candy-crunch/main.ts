import '../../styles/base.css';
import { recordEnginePlay } from '../../platform/gameHost';
import './style.css';
import { applyTranslations, getLang, setLang, type Lang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { CandyCrunch, W, H, type GameState } from './game';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new CandyCrunch();

const overlays: Record<string, HTMLElement> = {
  menu: $('#menuOverlay'),
  paused: $('#pauseOverlay'),
  levelClear: $('#levelClearOverlay'),
  gameOver: $('#overOverlay'),
};

function showOverlay(state: GameState): void {
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle('hidden', key !== state);
  }
}

game.onStateChange = showOverlay;

game.onLevelChange = () => {
  showOverlay('playing');
};

game.onGameOver = (score, _level, record) => {
  void recordEnginePlay('candy-crunch', score);
  $('#finalScore').textContent = `Final Score: ${score}`;
  $('#newBest').classList.toggle('hidden', !record);
};

const input = new Input(document.body);
input.onAction((a) => {
  if (a === 'pause') {
    if (game.state === 'playing') game.pause();
    else if (game.state === 'paused') game.resume();
    return;
  }
  game.handleAction(a);
});

$('#startBtn').addEventListener('click', () => game.start());
$('#againBtn').addEventListener('click', () => game.start());
$('#restartBtn').addEventListener('click', () => game.start());
$('#resumeBtn').addEventListener('click', () => game.resume());
$('#nextBtn').addEventListener('click', () => game.start()); // Start will advance to next level
$('#pauseBtn').addEventListener('click', () => {
  if (game.state === 'playing') game.pause();
  else if (game.state === 'paused') game.resume();
});

const muteBtn = $('#muteBtn');
muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
muteBtn.addEventListener('click', () => {
  muteBtn.textContent = sfx.toggleMute() ? '🔇' : '🔊';
});

const langEn = $('#langEn');
const langAm = $('#langAm');
function syncLangButtons(): void {
  const lang = getLang();
  langEn.classList.toggle('active', lang === 'en');
  langAm.classList.toggle('active', lang === 'am');
}
function pick(lang: Lang): void {
  setLang(lang);
  syncLangButtons();
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => {
    game.render(ctx);
  },
);

document.documentElement.lang = getLang();
applyTranslations();
syncLangButtons();
showOverlay('menu');
loop.start();
