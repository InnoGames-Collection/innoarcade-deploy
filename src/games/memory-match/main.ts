// Memory Match — a skill game a built-in GoPlay game.
//
// The original used page-global hooks (window.currentGameWin, currentCoinsCost,
// currentPointsWin, playSound). Those are replaced by the shared GameHost: it
// owns the economy/best-score wiring, so the same logic drops straight onto the
// InnoArcade platform and, by flipping the catalog `mode`, could become a
// tournament with no change here.

import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { loadTournaments, loadMyEntries } from '../../platform/tournaments';

const host = createHost('memory-match');

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

// Map the GoPlay sound names onto the engine's synthesised SFX.
function play(type: 'flip' | 'match' | 'nomatch' | 'win' | 'lose' | 'click'): void {
  switch (type) {
    case 'flip': case 'click': sfx.click(); break;
    case 'match': case 'win': sfx.coin(); break;
    case 'nomatch': sfx.slide(); break;
    case 'lose': sfx.crash(); break;
  }
}

const ROUND_SECONDS = 120; // 2-minute bounded round
const emojis = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑'];

let cards: string[] = [];
let flipped: HTMLElement[] = [];
let moves = 0;
let pairs = 0;
let canFlip = false;
let roundOver = true;     // idle until the player presses Play
let playing = false;
let rankedThisRun = false;
let secondsLeft = ROUND_SECONDS;
let timerId = 0;

const grid = $('#mm-grid');
const timeEl = $('#mm-time');
const movesEl = $('#mm-moves');
const pairsEl = $('#mm-pairs');
const scoreEl = $('#mm-score');
const message = $('#mm-message');
const restartBtn = $('#mm-restart-btn');
const playBtn = $('#mm-play-btn') as HTMLButtonElement;

function setHUD(): void {
  $('#mm-hud-cost').textContent = host.costCoins > 0 ? `${host.costCoins} 🪙` : t('mm.free');
  $('#mm-hud-win').textContent = String(host.attemptsLeft);
}

// Score (doc-style normalization input): rewards pairs found, speed (time left)
// and efficiency (fewer moves). No win/lose — the score itself is the reward.
function liveScore(): number {
  const used = ROUND_SECONDS - secondsLeft;
  return Math.max(0, pairs * 100 + Math.max(0, ROUND_SECONDS - used) * 2 - moves * 5);
}
function fmtTime(s: number): string {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}
function refreshStats(): void {
  timeEl.textContent = fmtTime(Math.max(0, secondsLeft));
  movesEl.textContent = String(moves);
  pairsEl.textContent = `${pairs}/6`;
  scoreEl.textContent = String(liveScore());
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBoard(): void {
  cards = shuffle([...emojis, ...emojis]);
  flipped = [];
  moves = 0;
  pairs = 0;
  grid.innerHTML = '';
  cards.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.className = 'mm-card';
    card.dataset.i = String(i);
    card.dataset.e = emoji;
    card.textContent = '❓';
    card.addEventListener('click', () => flipCard(card));
    grid.appendChild(card);
  });
  refreshStats();
}

// Start a paid round: consume a banked attempt or buy the next block (pay-once →
// N attempts); if refused, play a free practice round. Each Play/Replay = a round.
async function startPlay(): Promise<void> {
  if (playing) return;
  const res = await host.begin();
  rankedThisRun = res.ok;
  if (!res.ok) {
    if (res.reason === 'coins') message.textContent = t('mm.needCoins');
    else if (res.reason === 'level') message.textContent = t('mm.reachLevel').replace('{n}', String(host.requiredLevel));
    else if (res.reason === 'auth') message.textContent = t('td.signInToRank');
  } else {
    message.textContent = '';
  }
  message.style.color = '';
  buildBoard();
  playing = true;
  roundOver = false;
  canFlip = true;
  secondsLeft = ROUND_SECONDS;
  refreshStats();
  setHUD();
  clearInterval(timerId);
  timerId = window.setInterval(tick, 1000);
}

function tick(): void {
  secondsLeft -= 1;
  refreshStats();
  if (secondsLeft <= 0) endRound('time');
}

function endRound(why: 'time' | 'cleared'): void {
  if (roundOver) return;
  roundOver = true;
  playing = false;
  canFlip = false;
  clearInterval(timerId);
  const finalScore = liveScore();
  const durationMs = (ROUND_SECONDS - Math.max(0, secondsLeft)) * 1000;
  message.textContent = (why === 'cleared' ? t('mm.cleared') : t('mm.timeUp')).replace('{n}', String(finalScore));
  message.style.color = '#ffd700';
  void host.finish(finalScore, false, durationMs, { ranked: rankedThisRun }).then((r) => {
    setHUD();
    if (rankedThisRun && r.rank) message.textContent += ` · #${r.rank}/${r.total}`;
  });
}

function flipCard(card: HTMLElement): void {
  if (!playing || !canFlip || card.classList.contains('flipped') || card.classList.contains('matched')) return;
  play('flip');
  card.classList.add('flipped');
  card.textContent = card.dataset.e!;
  flipped.push(card);
  if (flipped.length === 2) {
    moves++;
    canFlip = false;
    checkMatch();
  }
  refreshStats();
}

function checkMatch(): void {
  const [c1, c2] = flipped;
  if (c1.dataset.e === c2.dataset.e) {
    c1.classList.add('matched');
    c2.classList.add('matched');
    pairs++;
    flipped = [];
    canFlip = true;
    play('match');
    refreshStats();
    if (pairs === 6) { play('win'); endRound('cleared'); }
  } else {
    play('nomatch');
    setTimeout(() => {
      c1.classList.remove('flipped');
      c2.classList.remove('flipped');
      c1.textContent = '❓';
      c2.textContent = '❓';
      flipped = [];
      if (!roundOver) canFlip = true;
    }, 900);
  }
}

playBtn.addEventListener('click', () => void startPlay());
restartBtn.addEventListener('click', () => { play('click'); void startPlay(); });

// --- Language switch --------------------------------------------------------
const langEn = $('#langEn');
const langAm = $('#langAm');
function syncLangButtons(): void {
  const lang = getLang();
  langEn.classList.toggle('active', lang === 'en');
  langAm.classList.toggle('active', lang === 'am');
  setHUD();
}
function pick(lang: Lang): void {
  setLang(lang);
  applyTranslations();
  syncLangButtons();
  if (!playing && roundOver) message.textContent = t('mm.tapPlay');
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
syncLangButtons();
setHUD();
buildBoard();
message.textContent = t('mm.tapPlay');

// Hydrate the live tournament + attempt bank so cost/attempts show before Play.
void Promise.all([loadTournaments(), loadMyEntries()]).then(() => setHUD());

