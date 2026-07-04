import '../../styles/base.css';
import '../../styles/game-shell.css';
import { createHost } from '../../platform/gameHost';
import {
  applyTournamentPlayLabels, promptTournamentEntry, refreshTournamentMenuPanel,
  startTournamentRound, submitTournamentRound, tournamentAttemptsLeft,
} from '../../platform/tournamentGameFlow';
import {
  pushShellHistory, wireFreeShellCloseButtons, wireFreeShellBackNavigation,
  type FreeShellNavHandlers,
} from '../../platform/freeShellNav';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { FruitSlice, W, H, type GameState } from './game';

const GAME_ID = 'fruit-slice';
const host = createHost(GAME_ID);

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

type Phase = 'menu' | 'playing' | 'paused' | 'over';

let phase: Phase = 'menu';
let rankedThisRun = false;
let starting = false;
let toastT = 0;

const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);

function resizeCanvas(): void {
  const wrap = canvas.parentElement!;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w < 1 || h < 1) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
}

function canvasLayout(): { scale: number; offX: number; offY: number } {
  const wrap = canvas.parentElement!;
  const cw = wrap.clientWidth;
  const ch = wrap.clientHeight;
  const scale = cw / W;
  const drawH = H * scale;
  return {
    scale,
    offX: 0,
    offY: (ch - drawH) / 2,
  };
}

const game = new FruitSlice();

function renderFrame(): void {
  const { scale, offX, offY } = canvasLayout();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2d1b4e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const s = scale * dpr;
  ctx.setTransform(s, 0, 0, s, offX * dpr, offY * dpr);
  game.render(ctx);
  if (game.state === 'playing' || game.state === 'paused') updatePlayHud();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
if (canvas.parentElement) {
  new ResizeObserver(() => resizeCanvas()).observe(canvas.parentElement);
}

function showToast(msg: string): void {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = window.setTimeout(() => el.classList.add('hidden'), 2800);
}

function attemptsLeft(): number {
  return tournamentAttemptsLeft(GAME_ID);
}

function updateActionButtons(): void {
  applyTournamentPlayLabels(GAME_ID, {
    start: phase === 'menu' ? ($('#startBtn') as HTMLButtonElement) : null,
    again: phase === 'over' ? ($('#againBtn') as HTMLButtonElement) : null,
    restart: $('#restartBtn') as HTMLButtonElement,
  });
}

function syncAttemptsUi(): void {
  updateActionButtons();
}

function showMenu(): void {
  $('#menuOverlay').classList.remove('hidden');
  $('#fsPlayFrame').classList.add('hidden');
  $('#fsBackdrop').classList.remove('hidden');
  hideOverOverlay();
}

function showGame(): void {
  $('#menuOverlay').classList.add('hidden');
  $('#fsPlayFrame').classList.remove('hidden');
  $('#fsBackdrop').classList.add('hidden');
  if (phase === 'playing' || phase === 'paused') {
    updatePlayHud();
    requestAnimationFrame(() => resizeCanvas());
  }
}

function setPhase(next: Phase): void {
  const prev = phase;
  phase = next;
  if (next === 'menu') showMenu();
  else showGame();
  $('#closeBtn').classList.toggle('hidden', next === 'menu' || next === 'over');
  $('#pauseOverlay').classList.toggle('hidden', next !== 'paused');
  updateActionButtons();
  if (next !== 'menu' && prev === 'menu') pushShellHistory();
  if (next === 'paused' && prev !== 'paused') pushShellHistory();
  if (next === 'over' && prev !== 'over') pushShellHistory();
}

function goMenu(): void {
  game.pause();
  setPhase('menu');
}

function showOverOverlay(final: number): void {
  const overlay = $('#overOverlay');
  $('#fsFinalScore').textContent = final.toLocaleString();
  $('#fsFinalBest').textContent = '—';
  $('#newBest').classList.add('hidden');
  $('#fsRunReward').innerHTML = `<span class="shell-rr-pending">…</span>`;
  $('#fsBoardOver').innerHTML = '';
  $('#closeBtn').classList.add('hidden');
  updateActionButtons();
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function hideOverOverlay(): void {
  const overlay = $('#overOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function getOverlay(): string | null {
  const pause = document.getElementById('pauseOverlay');
  if (pause && !pause.classList.contains('hidden')) return 'paused';
  const over = document.getElementById('overOverlay');
  if (over && !over.classList.contains('hidden')) return 'over';
  return null;
}

const navHandlers: FreeShellNavHandlers = {
  getPhase: () => phase,
  getOverlay,
  goMenu,
  resumePlaying: () => game.resume(),
};

function syncShellFromGameState(state: GameState): void {
  if (state === 'menu') setPhase('menu');
  else if (state === 'playing') {
    hideOverOverlay();
    setPhase('playing');
  } else if (state === 'paused') setPhase('paused');
}

game.onStateChange = (state: GameState) => {
  if (state === 'gameOver') return;
  syncShellFromGameState(state);
};

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function updatePlayHud(): void {
  const elapsed = game.elapsedSeconds();
  $('#fsTime').textContent = fmtTime(elapsed);
  $('#fsScore').textContent = String(game.score);
  $('#fsLives').textContent = String(game.lives);
  $('#fsCombo').textContent = game.combo > 1 ? `${game.combo}×` : '—';
}

async function refreshTournamentPanel(): Promise<void> {
  await refreshTournamentMenuPanel(GAME_ID, $('#fsTourney'));
  updateActionButtons();
}

async function submitRun(score: number, durationMs: number, isWin: boolean): Promise<void> {
  await submitTournamentRound(host, GAME_ID, score, isWin, durationMs, rankedThisRun, {
    rewardEl: $('#fsRunReward'),
    boardEl: $('#fsBoardOver'),
    showToast,
    onBest: (best, isRecord) => {
      $('#fsFinalBest').textContent = best.toLocaleString();
      $('#newBest').classList.toggle('hidden', !isRecord);
    },
    onSync: () => { syncAttemptsUi(); void refreshTournamentPanel(); },
  });
}

game.onGameOver = (score, durationMs) => {
  setPhase('over');
  showOverOverlay(score);
  void submitRun(score, durationMs, score >= host.winScore);
};

async function onEnter(): Promise<void> {
  promptTournamentEntry(GAME_ID, () => { void refreshTournamentPanel(); }, () => { void onPlayOrEnter(); });
}

async function onPlayOrEnter(): Promise<void> {
  if (starting || phase === 'playing' || phase === 'paused') return;
  if (attemptsLeft() <= 0) {
    await onEnter();
    return;
  }
  await beginRankedRound();
}

async function beginRankedRound(): Promise<void> {
  if (starting) return;
  starting = true;
  try {
    if (!(await startTournamentRound(host, showToast))) {
      setPhase('menu');
      return;
    }
    rankedThisRun = true;
    hideOverOverlay();
    game.start();
    syncAttemptsUi();
    void refreshTournamentPanel();
  } finally {
    starting = false;
  }
}

async function restartRound(): Promise<void> {
  if (phase !== 'paused') return;
  hideOverOverlay();
  await beginRankedRound();
}

const input = new Input(document.body);
input.onAction((a) => game.handleAction(a));

function pointerPos(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cw = rect.width;
  const ch = rect.height;
  const scale = cw / W;
  const drawH = H * scale;
  const offY = (ch - drawH) / 2;
  return {
    x: (e.clientX - rect.left) / scale,
    y: (e.clientY - rect.top - offY) / scale,
  };
}

let isSlicing = false;
canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  const { x, y } = pointerPos(e);
  isSlicing = true;
  game.startSlice(x, y);
});

canvas.addEventListener('pointermove', (e) => {
  if (!isSlicing || game.state !== 'playing') return;
  const { x, y } = pointerPos(e);
  game.continueSlice(x, y);
});

canvas.addEventListener('pointerup', () => {
  isSlicing = false;
  game.endSlice();
});

canvas.addEventListener('pointerleave', () => {
  isSlicing = false;
  game.endSlice();
});

$('#startBtn').addEventListener('click', () => void onPlayOrEnter());
$('#againBtn').addEventListener('click', () => void onPlayOrEnter());
$('#restartBtn').addEventListener('click', () => void restartRound());
$('#resumeBtn').addEventListener('click', () => game.resume());
$('#pauseBtn').addEventListener('click', () => {
  if (game.state === 'playing') game.pause();
  else if (game.state === 'paused') game.resume();
});

const muteBtn = $('#muteBtn');
muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
muteBtn.addEventListener('click', () => {
  muteBtn.textContent = sfx.toggleMute() ? '🔇' : '🔊';
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
});

const stage = document.getElementById('stage');
if (stage) {
  wireFreeShellCloseButtons(stage, navHandlers);
  wireFreeShellBackNavigation(navHandlers);
}

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => renderFrame(),
);

document.documentElement.lang = getLang();
applyTranslations();
setPhase('menu');
loop.start();

void refreshTournamentPanel();
