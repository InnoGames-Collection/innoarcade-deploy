import '../../styles/base.css';
import '../../styles/game-shell.css';
import { GameHost } from '../../platform/gameHost';
import { openTournamentEntryForGame } from '../../hub/tournamentEntry';
import { openSignIn } from '../../hub/signin';
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

function renderFrame(): void {
  const wrap = canvas.parentElement!;
  const cw = wrap.clientWidth;
  const ch = wrap.clientHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sx = (cw / W) * dpr;
  const sy = (ch / H) * dpr;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  game.render(ctx);
  if (game.state === 'playing' || game.state === 'paused') updatePlayHud();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

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
  $('#startBtn').textContent = playLabel;
  $('#againBtn').textContent = playLabel;
  $('#restartBtn').textContent = attemptsLeft() > 0 ? t('td.restart') : t('hub.play');
}

function syncAttemptsUi(): void {
  updateActionButtons();
}

function updatePlayHud(): void {
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
  if (inRun) updatePlayHud();
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
  );

  updateActionButtons();
}

function showGameOverOverlay(score: number): void {
  $('#fsFinalScore').textContent = score.toLocaleString();
  $('#fsFinalBest').textContent = serverBest > 0 ? serverBest.toLocaleString() : '—';
  $('#newBest').classList.add('hidden');
  $('#fsRunReward').innerHTML = `<span class="fs-rr-pending">…</span>`;
  $('#fsBoardOver').innerHTML = '';
  updateActionButtons();
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
  reward.innerHTML = `<span class="fs-rr-pending">…</span>`;
  let res;
  try {
    res = await host.finish(score, isWin, durationMs, { ranked: rankedThisRun });
  } catch {
    reward.innerHTML = `<span class="fs-rr-note">${t('td.signInToRank')}</span>`;
    if (isConfigured() && !(await currentUser())) openSignIn();
    else showToast(t('td.signInToRank'));
    return;
  }
  if (rankedThisRun && res.rank == null) {
    reward.innerHTML = `<span class="fs-rr-note">${t('td.signInToRank')}</span>`;
    if (!(await currentUser())) openSignIn();
    else showToast(t('td.signInToRank'));
    return;
  }
  serverBest = res.best ?? serverBest;
  $('#fsFinalBest').textContent = serverBest.toLocaleString();
  $('#newBest').classList.toggle('hidden', !res.isRecord);
  reward.innerHTML = `<span class="fs-rr-stat"><b>${t('td.rank')}</b> #${res.rank ?? '—'}/${res.total ?? '—'}</span>
    <span class="fs-rr-stat"><b>${t('td.best')}</b> ${serverBest.toLocaleString()}</span>`;
  if (typeof res.attemptsLeft === 'number') {
    reward.innerHTML += `<span class="fs-rr-stat">🎟️ ${t('td.attemptsLeft')}: <strong>${res.attemptsLeft}</strong></span>`;
  }
  const tour = getTournamentForGame(GAME_ID);
  if (tour) {
    const board = await leaderboardRemote(tour.id, 5);
    const standing = await playerStandingRemote(tour.id);
    boardOver.innerHTML = tournamentBoardHtml(board, standing);
  }
  syncAttemptsUi();
  void refreshTournamentPanel();
}

game.onGameOver = (score, durationMs) => {
  showGameOverOverlay(score);
  void submitRun(score, durationMs, score >= host.winScore);
};

async function onEnter(): Promise<void> {
  openTournamentEntryForGame(GAME_ID, {
    onEntered: () => { void refreshTournamentPanel(); },
    onPlay: () => { void onPlayOrEnter(); },
  });
}

async function onPlayOrEnter(): Promise<void> {
  if (starting || game.state === 'playing' || game.state === 'paused') return;
  if (attemptsLeft() <= 0) {
    await onEnter();
    return;
  }
  await beginRankedRound();
}

async function beginRankedRound(): Promise<void> {
  if (starting) return;
  if (isConfigured() && !(await currentUser())) {
    openSignIn();
    return;
  }
  starting = true;
  try {
    await host.startRound();
    rankedThisRun = true;
    game.start();
    syncAttemptsUi();
    void refreshTournamentPanel();
  } catch {
    showOverlay('menu');
    if (isConfigured() && !(await currentUser())) openSignIn();
    else showToast(t('td.signInToRank'));
  } finally {
    starting = false;
  }
}

const input = new Input(document.body);
input.onAction((a) => game.handleAction(a));

function pointerPos(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / (rect.width / W),
    y: (e.clientY - rect.top) / (rect.height / H),
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
