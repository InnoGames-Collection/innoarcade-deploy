// Memory Match — tournament weekly game (GoPlay / InnoArcade).

import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { openTournamentEntryForGame } from '../../hub/tournamentEntry';
import { createHost } from '../../platform/gameHost';
import { refreshGameTournamentPanel } from '../../platform/gameTournamentPanel';
import { loadTournaments, loadMyEntries, myEntry, getTournamentForGame } from '../../platform/tournaments';

const GAME_ID = 'memory-match';
const host = createHost(GAME_ID);
const tourneyMount = (): HTMLElement => $('#mmTourney');

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

function play(type: 'flip' | 'match' | 'nomatch' | 'win' | 'lose' | 'click'): void {
  switch (type) {
    case 'flip': case 'click': sfx.click(); break;
    case 'match': case 'win': sfx.coin(); break;
    case 'nomatch': sfx.slide(); break;
    case 'lose': sfx.crash(); break;
  }
}

const ROUND_SECONDS = 120;
const emojis = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑'];

let cards: string[] = [];
let flipped: HTMLElement[] = [];
let moves = 0;
let pairs = 0;
let canFlip = false;
let roundOver = true;
let playing = false;
let rankedThisRun = false;
let secondsLeft = ROUND_SECONDS;
let timerId = 0;
let roundSeq = 0;
let starting = false;

const grid = $('#mm-grid');
const timeEl = $('#mm-time');
const movesEl = $('#mm-moves');
const pairsEl = $('#mm-pairs');
const scoreEl = $('#mm-score');
const restartBtn = $('#mm-restart-btn') as HTMLButtonElement;
const playBtn = $('#mm-play-btn') as HTMLButtonElement;

function attemptsLeft(): number {
  const tour = getTournamentForGame(GAME_ID);
  return tour ? (myEntry(tour.id)?.left ?? 0) : 0;
}

function playLabel(): string {
  const left = attemptsLeft();
  return left > 0 ? `▶ ${t('mm.play')} · 🎟️ ${left}` : t('mm.play');
}

function updateActionButtons(): void {
  const label = playLabel();
  playBtn.textContent = label;
  restartBtn.textContent = attemptsLeft() > 0 ? t('mm.replay') : label;
}

async function refreshTournamentPanel(): Promise<void> {
  await refreshGameTournamentPanel(GAME_ID, tourneyMount());
  updateActionButtons();
}

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

function revealAll(show: boolean): void {
  document.querySelectorAll<HTMLElement>('.mm-card').forEach((card) => {
    if (card.classList.contains('matched')) return;
    if (show) { card.textContent = card.dataset.e!; card.classList.add('flipped'); }
    else if (!flipped.includes(card)) { card.textContent = '❓'; card.classList.remove('flipped'); }
  });
}

async function onEnter(): Promise<void> {
  openTournamentEntryForGame(GAME_ID, {
    onEntered: () => { void refreshTournamentPanel(); },
    onPlay: () => { void onPlayOrEnter(); },
  });
}

/** Runner-style: entry modal when attempts = 0; startRound only when banked. */
async function onPlayOrEnter(): Promise<void> {
  if (starting) return;
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
    await host.startRound();
    rankedThisRun = true;
    const seq = ++roundSeq;
    clearInterval(timerId);
    buildBoard();
    playing = true;
    roundOver = false;
    canFlip = false;
    secondsLeft = ROUND_SECONDS;
    refreshStats();
    void refreshTournamentPanel();
    play('flip');
    revealAll(true);
    window.setTimeout(() => {
      if (seq !== roundSeq) return;
      revealAll(false);
      canFlip = true;
      timerId = window.setInterval(() => tick(seq), 1000);
    }, 1000);
  } catch {
    // Auth / network — ranked round not started.
  } finally {
    starting = false;
    updateActionButtons();
  }
}

function tick(seq: number): void {
  if (seq !== roundSeq) return;
  secondsLeft -= 1;
  refreshStats();
  if (secondsLeft <= 0) endRound('time');
}

function endRound(_why: 'time' | 'cleared'): void {
  if (roundOver) return;
  roundOver = true;
  playing = false;
  canFlip = false;
  clearInterval(timerId);
  const finalScore = liveScore();
  const durationMs = (ROUND_SECONDS - Math.max(0, secondsLeft)) * 1000;
  void host.finish(finalScore, false, durationMs, { ranked: rankedThisRun }).then(() => {
    void refreshTournamentPanel();
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

playBtn.addEventListener('click', () => void onPlayOrEnter());
restartBtn.addEventListener('click', () => { play('click'); void onPlayOrEnter(); });

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
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
syncLangButtons();
buildBoard();
updateActionButtons();

void Promise.all([loadTournaments(), loadMyEntries()]).then(() => refreshTournamentPanel());
