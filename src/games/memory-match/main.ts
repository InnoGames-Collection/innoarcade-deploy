// Memory Match — weekly tournament game (GoPlay / InnoArcade).

import '../../styles/base.css';
import '../../styles/game-shell.css';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import {
  applyTournamentPlayLabels, promptTournamentEntry, refreshTournamentMenuPanel,
  startTournamentRound, submitTournamentRound, tournamentAttemptsLeft,
} from '../../platform/tournamentGameFlow';

const GAME_ID = 'memory-match';
const host = createHost(GAME_ID);

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

/** End-of-attempt score only (not shown live during play). */
const TIME_BASE = 3000;
const TIME_DRAIN_PER_SEC = 27;
const PAIR_GAIN = 100;
/** Penalty per wasted two-card try (moves − pairs). */
const WASTED_MOVE_LOSS = 52;

const ROUND_SECONDS = 120;
const PAIR_COUNT = 6;
const emojis = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑'];

type Phase = 'menu' | 'playing' | 'paused' | 'over';

let cards: string[] = [];
let flipped: HTMLElement[] = [];
let moves = 0;
let pairs = 0;
let canFlip = false;
let phase: Phase = 'menu';
let rankedThisRun = false;
let secondsLeft = ROUND_SECONDS;
let timerId = 0;
let roundSeq = 0;
let starting = false;
/** Frozen final score for this attempt (shown after round ends). */
let lastFinalScore = 0;
let toastT = 0;

function showToast(msg: string): void {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = window.setTimeout(() => el.classList.add('hidden'), 2800);
}

const grid = $('#mm-grid');
const timeEl = $('#mm-time');
const movesEl = $('#mm-moves');
const pairsEl = $('#mm-pairs');
const scoreEl = $('#mm-score');
const startBtn = $('#mmStartBtn') as HTMLButtonElement;
const pauseBtn = $('#mm-pause-btn') as HTMLButtonElement;
const resumeBtn = $('#mm-resume-btn') as HTMLButtonElement;
const restartBtn = $('#mm-restart-btn') as HTMLButtonElement;

function playButtons() {
  return {
    start: phase === 'menu' ? startBtn : null,
    again: phase === 'over' ? ($('#mmAgainBtn') as HTMLButtonElement) : null,
    restart: restartBtn,
  };
}

function syncAttemptsUi(): void {
  applyTournamentPlayLabels(GAME_ID, playButtons());
}

function showMenu(): void {
  $('#menuOverlay').classList.remove('hidden');
  $('#memory-match-wrapper').classList.add('hidden');
  $('#mmBackdrop').classList.remove('hidden');
  hideOverOverlay();
}

function showGame(): void {
  $('#menuOverlay').classList.add('hidden');
  $('#memory-match-wrapper').classList.remove('hidden');
  $('#mmBackdrop').classList.add('hidden');
}

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

/** timeGain = 3000 − spent×27 */
function timeGain(): number {
  return Math.max(0, TIME_BASE - spentSeconds() * TIME_DRAIN_PER_SEC);
}

function pairGain(): number {
  return pairs * PAIR_GAIN;
}

function moveLoss(): number {
  return Math.max(0, moves - pairs) * WASTED_MOVE_LOSS;
}

/** score = timeGain + pairGain − moveLoss */
function computeScore(): number {
  return Math.max(0, timeGain() + pairGain() - moveLoss());
}

const SCORE_PLACEHOLDER = '—';

function scoreDisplayText(): string {
  if (phase === 'over') return String(lastFinalScore);
  return SCORE_PLACEHOLDER;
}

function setPhase(next: Phase): void {
  phase = next;
  if (next === 'menu') showMenu();
  else showGame();
  $('#mmCloseBtn').classList.toggle('hidden', next === 'menu' || next === 'over');
  pauseBtn.classList.toggle('hidden', next !== 'playing');
  resumeBtn.classList.toggle('hidden', next !== 'paused');
  restartBtn.classList.toggle('hidden', next !== 'paused');
  grid.classList.toggle('mm-paused', next === 'paused' || next === 'over');
  syncAttemptsUi();
}

function showOverOverlay(final: number): void {
  const overlay = $('#mmOverOverlay');
  $('#mmFinalScore').textContent = final.toLocaleString();
  $('#mmFinalBest').textContent = SCORE_PLACEHOLDER;
  $('#mmNewBest').classList.add('hidden');
  $('#mmRunReward').innerHTML = `<span class="mm-rr-pending">…</span>`;
  $('#mmBoardOver').innerHTML = '';
  $('#mmCloseBtn').classList.add('hidden');
  syncAttemptsUi();
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function hideOverOverlay(): void {
  const overlay = $('#mmOverOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

async function refreshTournamentPanel(): Promise<void> {
  await refreshTournamentMenuPanel(GAME_ID, $('#mmTourney'));
  syncAttemptsUi();
}

async function submitRound(score: number, cleared: boolean, durationMs: number): Promise<void> {
  await submitTournamentRound(host, GAME_ID, score, cleared, durationMs, rankedThisRun, {
    rewardEl: $('#mmRunReward'),
    boardEl: $('#mmBoardOver'),
    cssPrefix: 'mm-rr',
    showToast,
    onBest: (best, isRecord) => {
      $('#mmFinalBest').textContent = best.toLocaleString();
      $('#mmNewBest').classList.toggle('hidden', !isRecord);
      if (isRecord) bumpScoreStat();
    },
    onSync: () => { syncAttemptsUi(); void refreshTournamentPanel(); },
  });
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function refreshStats(): void {
  timeEl.textContent = fmtTime(Math.max(0, secondsLeft));
  movesEl.textContent = String(moves);
  pairsEl.textContent = `${pairs}/${PAIR_COUNT}`;
  scoreEl.textContent = scoreDisplayText();
}

function bumpScoreStat(): void {
  scoreEl.closest('.mm-stat-score')?.classList.remove('mm-score-bump');
  void scoreEl.offsetWidth;
  scoreEl.closest('.mm-stat-score')?.classList.add('mm-score-bump');
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
    card.textContent = '?';
    card.addEventListener('click', () => flipCard(card));
    grid.appendChild(card);
  });
  refreshStats();
}

function revealAll(show: boolean): void {
  document.querySelectorAll<HTMLElement>('.mm-card').forEach((card) => {
    if (card.classList.contains('matched')) return;
    if (show) { card.textContent = card.dataset.e!; card.classList.add('flipped'); }
    else if (!flipped.includes(card)) { card.textContent = '?'; card.classList.remove('flipped'); }
  });
}

function abortRound(): void {
  roundSeq++;
  clearInterval(timerId);
  timerId = 0;
  canFlip = false;
  flipped = [];
}

async function onPlayOrEnter(): Promise<void> {
  if (starting || phase === 'playing' || phase === 'paused') return;
  if (tournamentAttemptsLeft(GAME_ID) <= 0) {
    promptTournamentEntry(GAME_ID, () => { void refreshTournamentPanel(); }, () => { void onPlayOrEnter(); });
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
    lastFinalScore = 0;
    hideOverOverlay();
    scoreEl.closest('.mm-stat-score')?.classList.remove('mm-score-bump');
    abortRound();
    startRoundWithBlink();
  } finally {
    starting = false;
  }
}

/** Briefly reveal all cards, then start the timer — used on Play and Play again. */
function startRoundWithBlink(): void {
  const seq = roundSeq;
  buildBoard();
  secondsLeft = ROUND_SECONDS;
  refreshStats();
  setPhase('playing');
  syncAttemptsUi();
  playSfx('flip');
  revealAll(true);
  window.setTimeout(() => {
    if (seq !== roundSeq) return;
    revealAll(false);
    canFlip = true;
    timerId = window.setInterval(() => tick(seq), 1000);
  }, 1000);
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

async function restartRound(): Promise<void> {
  if (phase !== 'paused') return;
  abortRound();
  hideOverOverlay();
  await beginRankedRound();
}

function tick(seq: number): void {
  if (seq !== roundSeq || phase !== 'playing') return;
  secondsLeft -= 1;
  refreshStats();
  if (secondsLeft <= 0) endRound();
}

function endRound(): void {
  if (phase !== 'playing' && phase !== 'paused') return;
  const cleared = pairs === PAIR_COUNT;
  if (!cleared) playSfx('lose');
  abortRound();
  lastFinalScore = computeScore();
  const durationMs = spentSeconds() * 1000;
  setPhase('over');
  scoreEl.textContent = String(lastFinalScore);
  bumpScoreStat();
  showOverOverlay(lastFinalScore);
  void submitRound(lastFinalScore, cleared, durationMs);
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
      c1.textContent = '?';
      c2.textContent = '?';
      flipped = [];
      canFlip = true;
      refreshStats();
    }, 900);
  }
}

startBtn.addEventListener('click', () => { playSfx('click'); void onPlayOrEnter(); });
$('#mmAgainBtn').addEventListener('click', () => { playSfx('click'); void onPlayOrEnter(); });
pauseBtn.addEventListener('click', () => { playSfx('click'); pauseRound(); });
resumeBtn.addEventListener('click', () => { playSfx('click'); resumeRound(); });
restartBtn.addEventListener('click', () => { playSfx('click'); void restartRound(); });

document.documentElement.lang = getLang();
applyTranslations();
setPhase('menu');

void refreshTournamentPanel();
