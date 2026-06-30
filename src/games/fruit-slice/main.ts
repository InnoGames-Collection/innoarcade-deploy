import '../../styles/base.css';
import '../../styles/game-shell.css';
import { GameHost } from '../../platform/gameHost';
import { openTournamentEntryForGame } from '../../hub/tournamentEntry';
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
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new FruitSlice();

let rankedThisRun = false;
let serverBest = 0;
let starting = false;

function gameTitle(): string {
  return getLang() === 'am' ? host.meta.nameAm : host.meta.nameEn;
}

// Minimal transient toast (this game has no toast element of its own).
let toastT = 0;
function toast(msg: string): void {
  let el = document.querySelector<HTMLElement>('#fsToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fsToast';
    el.style.cssText = 'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);background:rgba(17,24,48,.92);color:#fff;padding:.5rem .9rem;border-radius:999px;font-weight:700;z-index:50;pointer-events:none;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(toastT);
  toastT = window.setTimeout(() => { el!.style.opacity = '0'; }, 2400);
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
  const left = attemptsLeft();
  const playLabel = tournamentPlayLabel();
  $('#startBtn').textContent = playLabel;
  $('#againBtn').textContent = playLabel;
  $('#restartBtn').textContent = left > 0 ? t('td.restart') : t('hub.play');
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
  const playing = state === 'playing';
  $('#hud').classList.toggle('hidden', !playing);
  $('#closeBtn').classList.toggle('hidden', !playing);
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
  $('#fsFinalBest').textContent = '—';
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
    toast(t('td.signInToRank'));
    return;
  }
  if (rankedThisRun && res.rank == null) {
    reward.innerHTML = `<span class="fs-rr-note">${t('td.signInToRank')}</span>`;
    toast(t('td.signInToRank'));
    return;
  }
  serverBest = res.best ?? serverBest;
  $('#fsFinalBest').textContent = serverBest.toLocaleString();
  $('#newBest').classList.toggle('hidden', !res.isRecord);
  reward.innerHTML = `<span class="fs-rr-stat"><b>${t('td.rank')}</b> #${res.rank ?? '—'}/${res.total ?? '—'}</span>
    <span class="fs-rr-stat"><b>${t('td.best')}</b> ${serverBest.toLocaleString()}</span>`;
  const tour = getTournamentForGame(GAME_ID);
  if (tour) {
    const board = await leaderboardRemote(tour.id, 5);
    const standing = await playerStandingRemote(tour.id);
    boardOver.innerHTML = tournamentBoardHtml(board, standing);
  }
  void refreshTournamentPanel();
}

game.onGameOver = (score, record, durationMs) => {
  showGameOverOverlay(score);
  $('#newBest').classList.toggle('hidden', !record);
  void submitRun(score, durationMs, score >= host.winScore);
};

async function onEnter(): Promise<void> {
  openTournamentEntryForGame(GAME_ID, {
    onEntered: () => { void refreshTournamentPanel(); },
    onPlay: () => { void onPlayOrEnter(); },
  });
}

async function onPlayOrEnter(): Promise<void> {
  if (starting || game.state === 'playing') return;
  if (attemptsLeft() <= 0) {
    await onEnter();
    return;
  }
  await beginRankedRound();
}

async function beginRankedRound(): Promise<void> {
  if (starting) return;
  if (isConfigured() && !(await currentUser())) {
    toast(t('td.signInToRank'));
    return;
  }
  starting = true;
  try {
    await host.startRound();
    rankedThisRun = true;
    game.start();
    void refreshTournamentPanel();
  } catch {
    toast(t('td.signInToRank'));
  } finally {
    starting = false;
  }
}

const input = new Input(document.body);
input.onAction((a) => game.handleAction(a));

let isSlicing = false;
canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / (rect.width / W);
  const y = (e.clientY - rect.top) / (rect.height / H);
  isSlicing = true;
  game.startSlice(x, y);
});

canvas.addEventListener('pointermove', (e) => {
  if (!isSlicing || game.state !== 'playing') return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / (rect.width / W);
  const y = (e.clientY - rect.top) / (rect.height / H);
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
  () => {
    game.render(ctx);
  },
);

document.documentElement.lang = getLang();
applyTranslations();
updateActionButtons();
showOverlay('menu');
loop.start();

void Promise.all([loadTournaments(), loadMyEntries()]).then(() => refreshTournamentPanel());
