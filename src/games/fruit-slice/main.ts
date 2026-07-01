import '../../styles/base.css';
import '../../styles/game-shell.css';
import { GameHost } from '../../platform/gameHost';
import { openTournamentEntryForGame } from '../../hub/tournamentEntry';
import { promptIfSessionExpired } from '../../platform/sessionAuth';
import { renderShellMenuTournamentHtml, tournamentBoardHtml } from '../../platform/gameTournamentPanel';
import { balance } from '../../platform/wallet';
import { leaderboardRemote, playerStandingRemote } from '../../platform/backend';
import { isConfigured } from '../../platform/supabase';
import { currentUser } from '../../platform/auth';
import { loadTournaments, loadMyEntries, myEntry, getTournamentForGame } from '../../platform/tournaments';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { FruitSlice, W, H, type GameState } from './game';

const GAME_ID = 'fruit-slice';
const host = new GameHost(GAME_ID);

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

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
  // Fill the frame width; crop vertically if the stage is taller than the box.
  const scale = cw / W;
  const drawH = H * scale;
  return {
    scale,
    offX: 0,
    offY: (ch - drawH) / 2,
  };
}

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

const game = new FruitSlice();

let rankedThisRun = false;
let serverBest = 0;
let starting = false;
let toastT = 0;

function gameTitle(): string {
  return getLang() === 'am' ? host.meta.nameAm : host.meta.nameEn;
}

function showToast(msg: string): void {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = window.setTimeout(() => el.classList.add('hidden'), 2800);
}

function attemptsLeft(): number {
  const tour = getTournamentForGame(GAME_ID);
  return tour ? (myEntry(tour.id)?.left ?? 0) : 0;
}

function tournamentPlayLabel(): string {
  const left = attemptsLeft();
  return left > 0 ? `▶ ${t('hub.play')} · 🎟️ ${left}` : t('hub.play');
}

function updateActionButtons(): void {
  const playLabel = tournamentPlayLabel();
  const againBtn = $('#againBtn') as HTMLButtonElement;
  const startBtn = $('#startBtn') as HTMLButtonElement;
  startBtn.textContent = playLabel;
  againBtn.textContent = playLabel;
  againBtn.disabled = false;
  startBtn.disabled = false;
  $('#restartBtn').textContent = attemptsLeft() > 0 ? t('td.restart') : t('hub.play');
}

function syncAttemptsUi(): void {
  updateActionButtons();
}

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

const overlays: Record<string, HTMLElement> = {
  menu: $('#menuOverlay'),
  paused: $('#pauseOverlay'),
  gameOver: $('#overOverlay'),
};

function showOverlay(state: GameState): void {
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle('hidden', key !== state);
  }
  const inRun = state === 'playing' || state === 'paused';
  $('#fsPlayFrame').classList.toggle('hidden', !inRun);
  $('#fsBackdrop').classList.toggle('hidden', inRun);
  if (inRun) {
    updatePlayHud();
    requestAnimationFrame(() => resizeCanvas());
  }
}

game.onStateChange = showOverlay;

async function refreshTournamentPanel(): Promise<void> {
  const mount = $('#fsTourney');
  if (!isConfigured()) {
    mount.innerHTML = '';
    return;
  }
  await currentUser();
  await Promise.all([loadTournaments(), loadMyEntries()]);
  const tourney = getTournamentForGame(GAME_ID);
  if (!tourney) {
    mount.innerHTML = '';
    return;
  }

  const [walletCoins, standing, board] = await Promise.all([
    balance(),
    playerStandingRemote(tourney.id),
    leaderboardRemote(tourney.id, 5),
  ]);
  serverBest = standing?.score ?? 0;
  const left = myEntry(tourney.id)?.left ?? 0;

  mount.innerHTML = renderShellMenuTournamentHtml(
    gameTitle(), '🍉', walletCoins, serverBest, left, board,
    { hideBestIfOnBoard: true },
  );

  updateActionButtons();
}

function showGameOverOverlay(score: number): void {
  $('#fsFinalScore').textContent = score.toLocaleString();
  $('#fsFinalBest').textContent = serverBest > 0 ? serverBest.toLocaleString() : '—';
  $('#newBest').classList.add('hidden');
  $('#fsRunReward').innerHTML = `<span class="shell-rr-pending">…</span>`;
  $('#fsBoardOver').innerHTML = '';
  updateActionButtons();
}

async function failRankedSubmit(reward: HTMLElement): Promise<void> {
  if (await promptIfSessionExpired(showToast)) {
    reward.innerHTML = `<span class="shell-rr-note">${t('td.sessionExpired')}</span>`;
    return;
  }
  reward.innerHTML = `<span class="shell-rr-note">${t('td.submitFailed')}</span>`;
  showToast(t('td.submitFailed'));
}

async function submitRun(score: number, durationMs: number, isWin: boolean): Promise<void> {
  const reward = $('#fsRunReward');
  const boardOver = $('#fsBoardOver');
  if (!isConfigured()) {
    reward.innerHTML = '';
    boardOver.innerHTML = '';
    $('#fsFinalBest').textContent = score.toLocaleString();
    return;
  }
  reward.innerHTML = `<span class="shell-rr-pending">…</span>`;
  try {
    const res = await host.finish(score, isWin, durationMs, { ranked: rankedThisRun });
    if (rankedThisRun && res.rank == null) {
      await failRankedSubmit(reward);
      return;
    }
    serverBest = res.best ?? serverBest;
    $('#fsFinalBest').textContent = serverBest.toLocaleString();
    $('#newBest').classList.toggle('hidden', !res.isRecord);
    reward.innerHTML = `<span class="shell-rr-stat"><b>${t('td.rank')}</b> #${res.rank ?? '—'}/${res.total ?? '—'}</span>
      <span class="shell-rr-stat"><b>${t('td.best')}</b> ${serverBest.toLocaleString()}</span>`;
    if (typeof res.attemptsLeft === 'number') {
      reward.innerHTML += `<span class="shell-rr-stat">🎟️ ${t('td.attemptsLeft')}: <strong>${res.attemptsLeft}</strong></span>`;
    }
    const tour = getTournamentForGame(GAME_ID);
    if (tour) {
      const board = await leaderboardRemote(tour.id, 5);
      const standing = await playerStandingRemote(tour.id);
      boardOver.innerHTML = tournamentBoardHtml(board, standing);
    }
    syncAttemptsUi();
    void refreshTournamentPanel();
  } catch {
    await failRankedSubmit(reward);
  }
}

game.onGameOver = (score, durationMs) => {
  showGameOverOverlay(score);
  void submitRun(score, durationMs, score >= host.winScore);
};

function hideGameOverForReplay(): void {
  overlays.gameOver.classList.add('hidden');
  $('#fsPlayFrame').classList.remove('hidden');
  $('#fsBackdrop').classList.add('hidden');
}

async function beginRankedRound(): Promise<void> {
  if (starting) return;
  starting = true;
  const replay = game.state === 'gameOver';
  if (replay) hideGameOverForReplay();
  try {
    const left = await host.startRound();
    if (isConfigured() && host.isTournament && left === 0) {
      if (replay) showOverlay('gameOver');
      await onEnter();
      return;
    }
    rankedThisRun = true;
    game.start();
    syncAttemptsUi();
    void refreshTournamentPanel();
  } catch {
    if (replay) showOverlay('gameOver');
    else showOverlay('menu');
    if (!(await promptIfSessionExpired(showToast))) showToast(t('td.submitFailed'));
  } finally {
    starting = false;
  }
}

async function onPlayOrEnter(): Promise<void> {
  if (starting) return;
  if (game.state === 'playing' || game.state === 'paused') return;

  if (!isConfigured()) {
    starting = true;
    try {
      if (game.state === 'gameOver') hideGameOverForReplay();
      rankedThisRun = false;
      game.start();
    } finally {
      starting = false;
    }
    return;
  }

  // Menu / pause restart: local cache gate. Game-over replay: server decides via start-round.
  if (game.state !== 'gameOver' && attemptsLeft() <= 0) {
    await onEnter();
    return;
  }

  await beginRankedRound();
}

async function onEnter(): Promise<void> {
  openTournamentEntryForGame(GAME_ID, {
    onEntered: () => { void refreshTournamentPanel(); },
    onPlay: () => { void onPlayOrEnter(); },
  });
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
$('#restartBtn').addEventListener('click', () => void onPlayOrEnter());
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

const loop = new GameLoop(
  (dt) => game.update(dt),
  () => renderFrame(),
);

document.documentElement.lang = getLang();
applyTranslations();
updateActionButtons();
showOverlay('menu');
loop.start();

void Promise.all([loadTournaments(), loadMyEntries()]).then(() => refreshTournamentPanel());
