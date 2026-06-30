// Memory Match — weekly tournament game (GoPlay / InnoArcade).

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

/** Score = timeGain + pairGain − moveLoss (clamped ≥ 0). */
const TIME_BASE = 3000;
const TIME_DRAIN_PER_SEC = 25;
const PAIR_GAIN = 100;
/** Penalty per non-productive flip (moves − pairs); no move cap required. */
const WASTED_MOVE_LOSS = 40;

const ROUND_SECONDS = 120;
const PAIR_COUNT = 6;
const emojis = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑'];

type Phase = 'idle' | 'playing' | 'paused' | 'over';

let cards: string[] = [];
let flipped: HTMLElement[] = [];
let moves = 0;
let pairs = 0;
let canFlip = false;
let phase: Phase = 'idle';
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
const playBtn = $('#mm-play-btn') as HTMLButtonElement;
const pauseBtn = $('#mm-pause-btn') as HTMLButtonElement;
const resumeBtn = $('#mm-resume-btn') as HTMLButtonElement;
const restartBtn = $('#mm-restart-btn') as HTMLButtonElement;

function playSfx(type: 'flip' | 'match' | 'nomatch' | 'win' | 'lose' | 'click'): void {
  switch (type) {
    case 'flip': case 'click': sfx.click(); break;
    case 'match': case 'win': sfx.coin(); break;
    case 'nomatch': sfx.slide(); break;
    case 'lose': sfx.crash(); break;
  }
}

function spentSeconds(): number {
  return ROUND_SECONDS - Math.max(0, secondsLeft);
}

function timeGain(): number {
  return Math.max(0, TIME_BASE - spentSeconds() * TIME_DRAIN_PER_SEC);
}

function pairGain(): number {
  return pairs * PAIR_GAIN;
}

/** Failed two-card tries only — never penalises flips that found a pair. */
function moveLoss(): number {
  return Math.max(0, moves - pairs) * WASTED_MOVE_LOSS;
}

function computeScore(): number {
  return Math.max(0, timeGain() + pairGain() - moveLoss());
}

function attemptsLeft(): number {
  const tour = getTournamentForGame(GAME_ID);
  return tour ? (myEntry(tour.id)?.left ?? 0) : 0;
}

function playLabel(): string {
  const left = attemptsLeft();
  return left > 0 ? `▶ ${t('mm.play')} · 🎟️ ${left}` : t('mm.play');
}

function playAgainLabel(): string {
  const left = attemptsLeft();
  return left > 0 ? `▶ ${t('td.restart')} · 🎟️ ${left}` : t('td.restart');
}

function setPhase(next: Phase): void {
  phase = next;
  playBtn.classList.toggle('hidden', next !== 'idle' && next !== 'over');
  pauseBtn.classList.toggle('hidden', next !== 'playing');
  resumeBtn.classList.toggle('hidden', next !== 'paused');
  restartBtn.classList.toggle('hidden', next !== 'paused');
  grid.classList.toggle('mm-paused', next === 'paused');

  if (next === 'idle') playBtn.textContent = playLabel();
  else if (next === 'over') playBtn.textContent = playAgainLabel();
}

async function refreshTournamentPanel(): Promise<void> {
  await refreshGameTournamentPanel(GAME_ID, tourneyMount());
  if (phase === 'idle') playBtn.textContent = playLabel();
  else if (phase === 'over') playBtn.textContent = playAgainLabel();
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function refreshStats(): void {
  timeEl.textContent = fmtTime(Math.max(0, secondsLeft));
  movesEl.textContent = String(moves);
  pairsEl.textContent = `${pairs}/${PAIR_COUNT}`;
  scoreEl.textContent = String(computeScore());
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

function abortRound(): void {
  roundSeq++;
  clearInterval(timerId);
  timerId = 0;
  canFlip = false;
  flipped = [];
}

async function onEnter(): Promise<void> {
  openTournamentEntryForGame(GAME_ID, {
    onEntered: () => { void refreshTournamentPanel(); },
    onPlay: () => { void onPlayOrEnter(); },
  });
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
    await host.startRound();
    rankedThisRun = true;
    abortRound();
    const seq = roundSeq;
    buildBoard();
    secondsLeft = ROUND_SECONDS;
    refreshStats();
    setPhase('playing');
    void refreshTournamentPanel();
    playSfx('flip');
    revealAll(true);
    window.setTimeout(() => {
      if (seq !== roundSeq) return;
      revealAll(false);
      canFlip = true;
      timerId = window.setInterval(() => tick(seq), 1000);
    }, 1000);
  } catch {
    setPhase('idle');
  } finally {
    starting = false;
  }
}

function pauseRound(): void {
  if (phase !== 'playing') return;
  clearInterval(timerId);
  timerId = 0;
  canFlip = false;
  setPhase('paused');
}

function resumeRound(): void {
  if (phase !== 'paused') return;
  const seq = roundSeq;
  canFlip = flipped.length < 2;
  setPhase('playing');
  timerId = window.setInterval(() => tick(seq), 1000);
}

/** Abandon the in-progress round without submitting (runner-style restart). */
async function restartRound(): Promise<void> {
  if (phase !== 'paused') return;
  abortRound();
  setPhase('idle');
  await onPlayOrEnter();
}

function tick(seq: number): void {
  if (seq !== roundSeq || phase !== 'playing') return;
  secondsLeft -= 1;
  refreshStats();
  if (secondsLeft <= 0) endRound();
}

function endRound(): void {
  if (phase !== 'playing' && phase !== 'paused') return;
  abortRound();
  const finalScore = computeScore();
  const durationMs = spentSeconds() * 1000;
  setPhase('over');
  void host.finish(finalScore, false, durationMs, { ranked: rankedThisRun }).then(() => {
    void refreshTournamentPanel();
  });
}

function flipCard(card: HTMLElement): void {
  if (phase !== 'playing' || !canFlip || card.classList.contains('flipped') || card.classList.contains('matched')) return;
  playSfx('flip');
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
    playSfx('match');
    refreshStats();
    if (pairs === PAIR_COUNT) { playSfx('win'); endRound(); }
  } else {
    playSfx('nomatch');
    setTimeout(() => {
      if (phase !== 'playing') return;
      c1.classList.remove('flipped');
      c2.classList.remove('flipped');
      c1.textContent = '❓';
      c2.textContent = '❓';
      flipped = [];
      canFlip = true;
    }, 900);
  }
}

playBtn.addEventListener('click', () => { playSfx('click'); void onPlayOrEnter(); });
pauseBtn.addEventListener('click', () => { playSfx('click'); pauseRound(); });
resumeBtn.addEventListener('click', () => { playSfx('click'); resumeRound(); });
restartBtn.addEventListener('click', () => { playSfx('click'); void restartRound(); });

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
setPhase('idle');

void Promise.all([loadTournaments(), loadMyEntries()]).then(() => refreshTournamentPanel());
