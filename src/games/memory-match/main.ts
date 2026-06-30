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
import { openTournamentEntryForGame } from '../../hub/tournamentEntry';
import { createHost } from '../../platform/gameHost';
import { refreshGameTournamentPanel } from '../../platform/gameTournamentPanel';
import { loadTournaments, loadMyEntries } from '../../platform/tournaments';

const GAME_ID = 'memory-match';
const host = createHost(GAME_ID);
const tourneyMount = (): HTMLElement => $('#mmTourney');

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
let roundSeq = 0;    // invalidates stale preview/timer callbacks across restarts
let starting = false; // re-entrancy lock so a rapid double-tap can't double-charge

const grid = $('#mm-grid');
const timeEl = $('#mm-time');
const movesEl = $('#mm-moves');
const pairsEl = $('#mm-pairs');
const scoreEl = $('#mm-score');
const message = $('#mm-message');
const restartBtn = $('#mm-restart-btn');
const playBtn = $('#mm-play-btn') as HTMLButtonElement;

async function refreshTournamentPanel(): Promise<void> {
  await refreshGameTournamentPanel(GAME_ID, tourneyMount());
}

// --- Language switch --------------------------------------------------------
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

// Reveal/hide all unmatched cards (the 1-second preview shown when a round starts).
function revealAll(show: boolean): void {
  document.querySelectorAll<HTMLElement>('.mm-card').forEach((card) => {
    if (card.classList.contains('matched')) return;
    if (show) { card.textContent = card.dataset.e!; card.classList.add('flipped'); }
    else if (!flipped.includes(card)) { card.textContent = '❓'; card.classList.remove('flipped'); }
  });
}

// Start a paid round: consume a banked attempt or buy the next block (pay-once →
// N attempts); if refused, play a free practice round. Each Play/Replay reshuffles
// the board, shows a 1-second preview of all cards, then starts the 2-min timer.
async function startPlay(): Promise<void> {
  if (starting) return;
  starting = true;
  try {
    const res = await host.begin();
    if (!res.ok) {
      if (res.reason === 'coins') {
        openTournamentEntryForGame(GAME_ID, {
          onEntered: () => { void refreshTournamentPanel().then(() => startPlay()); },
          onPlay: () => { void startPlay(); },
        });
        return;
      }
      if (res.reason === 'auth') message.textContent = t('td.signInToRank');
      else message.textContent = t('td.enterFirst');
      return;
    }
    rankedThisRun = true;
    message.textContent = '';
    message.style.color = '';
    const seq = ++roundSeq;     // supersede any in-flight round (mid-round Replay)
    clearInterval(timerId);
    buildBoard();               // reshuffle
    playing = true;
    roundOver = false;
    canFlip = false;            // locked during the preview
    secondsLeft = ROUND_SECONDS;
    refreshStats();
    void refreshTournamentPanel();
    play('flip');
    revealAll(true);            // 1-second preview (what the old Peek did)
    window.setTimeout(() => {
      if (seq !== roundSeq) return; // a newer round replaced this one
      revealAll(false);
      canFlip = true;
      timerId = window.setInterval(() => tick(seq), 1000); // timer starts AFTER preview
    }, 1000);
  } finally {
    starting = false;
  }
}

function tick(seq: number): void {
  if (seq !== roundSeq) return; // stale timer from a superseded round
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
    void refreshTournamentPanel();
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
}
function pick(lang: Lang): void {
  setLang(lang);
  applyTranslations();
  syncLangButtons();
  void refreshTournamentPanel();
  if (!playing && roundOver) message.textContent = t('mm.tapPlay');
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
syncLangButtons();
buildBoard();
message.textContent = t('mm.tapPlay');

void Promise.all([loadTournaments(), loadMyEntries()]).then(() => refreshTournamentPanel());

