import '../../styles/base.css';
import { GameHost } from '../../platform/gameHost';
import { loadTournaments, loadMyEntries } from '../../platform/tournaments';
import './style.css';
import { applyTranslations, getLang, setLang, type Lang } from '../../i18n';
import { GameLoop } from '../../engine/loop';
import { Input } from '../../engine/input';
import { sfx } from '../../engine/audio';
import { FruitSlice, W, H, type GameState } from './game';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const canvas = $('#game') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new FruitSlice();

// Unified tournament economy (monthly cadence). A run is ranked when the player
// has a banked attempt (pay-once → N attempts); otherwise it's a free XP run.
const host = new GameHost('fruit-slice');
let rankedThisRun = false;

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

const overlays: Record<string, HTMLElement> = {
  menu: $('#menuOverlay'),
  paused: $('#pauseOverlay'),
  gameOver: $('#overOverlay'),
};

function showOverlay(state: GameState): void {
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle('hidden', key !== state);
  }
}

game.onStateChange = showOverlay;

game.onGameOver = (score, record) => {
  $('#finalScore').textContent = `Final Score: ${score}`;
  $('#newBest').classList.toggle('hidden', !record);
  void host.finish(score, score >= host.winScore, 0, { ranked: rankedThisRun }).then((res) => {
    const note = document.querySelector<HTMLElement>('#fsRanked');
    if (note) {
      note.textContent = (res.ranked ?? false)
        ? `🏆 Ranked · #${res.rank ?? '—'}/${res.total ?? '—'} · 🎟️ ${res.attemptsLeft ?? 0} left`
        : '';
    }
  });
};

// Authorise + start a round: consume a banked attempt, or buy the next block
// (pay-once → N attempts). If refused (coins/level/auth), fall back to a free run.
async function play(): Promise<void> {
  const res = await host.begin();
  if (!res.ok) {
    if (res.reason === 'coins') toast(`🪙 Not enough coins for entry (${host.costCoins})`);
    else if (res.reason === 'auth') toast('Sign in to compete');
    return;
  }
  rankedThisRun = true;
  game.start();
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

$('#startBtn').addEventListener('click', () => void play());
$('#againBtn').addEventListener('click', () => void play());
$('#restartBtn').addEventListener('click', () => void play());
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

// Hydrate the live tournament + the player's attempt bank so the first play
// knows whether it's a ranked attempt or a free run.
void Promise.all([loadTournaments(), loadMyEntries()]);
