// Memory Match — tournament game (GoPlay / InnoArcade).

import '../../styles/base.css';
import '../../styles/game-shell.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { createHost } from '../../platform/gameHost';
import {
  applyTournamentPlayLabels, promptTournamentEntry, refreshTournamentMenuPanel,
  startTournamentRound, submitTournamentRound, tournamentAttemptsLeft,
} from '../../platform/tournamentGameFlow';
import {
  pushShellHistory, wireFreeShellCloseButtons, wireFreeShellBackNavigation,
  type FreeShellNavHandlers,
} from '../../platform/freeShellNav';
import telebirrIcon from './icons/telebirr.png';
import ethioTelecomIcon from './icons/ethio-telecom.png';
import mesobIcon from './icons/mesob.png';
import jebenaIcon from './icons/jebena.png';
import nexsusIcon from './icons/nexsus.png';
import teleconnectIcon from './icons/teleconnect.png';
import { mmSfx } from './mm-sfx';
import {
  showScorePopup, spawnMatchVfx,
} from './mm-vfx';

const GAME_ID = 'memory-match';
const host = createHost(GAME_ID);

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const TIME_BASE = 3000;
const TIME_DRAIN_PER_SEC = 27;
const PAIR_GAIN = 100;
const WASTED_MOVE_LOSS = 52;

const ROUND_SECONDS = 120;
const PAIR_COUNT = 6;

interface CardIcon { id: string; src: string; alt: string; }

const CARD_ICONS: CardIcon[] = [
  { id: 'telebirr', src: telebirrIcon, alt: 'Telebirr' },
  { id: 'mesob', src: mesobIcon, alt: 'Mesob' },
  { id: 'jebena', src: jebenaIcon, alt: 'Jebena' },
  { id: 'teleconnect', src: teleconnectIcon, alt: 'Teleconnect' },
  { id: 'ethio-telecom', src: ethioTelecomIcon, alt: 'Ethio Telecom' },
  { id: 'nexsus', src: nexsusIcon, alt: 'znexus telecloud' },
];

const ICON_BY_ID = new Map(CARD_ICONS.map((icon) => [icon.id, icon]));

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
let lastFinalScore = 0;
let toastT = 0;
let roundStartMs = 0;

function showToast(msg: string): void {
  if (phase === 'over') return;
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
    again: null,
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
}

function playSfx(type: 'flip' | 'match' | 'nomatch' | 'win' | 'lose' | 'click'): void {
  switch (type) {
    case 'flip': mmSfx.flip(); break;
    case 'click': mmSfx.click(); break;
    case 'match': mmSfx.match(); break;
    case 'nomatch': mmSfx.nomatch(); break;
    case 'win': mmSfx.win(); break;
    case 'lose': mmSfx.lose(); break;
  }
}

function spentSeconds(): number { return ROUND_SECONDS - Math.max(0, secondsLeft); }
function timeGain(): number { return Math.max(0, TIME_BASE - spentSeconds() * TIME_DRAIN_PER_SEC); }
function pairGain(): number { return pairs * PAIR_GAIN; }
function moveLoss(): number { return Math.max(0, moves - pairs) * WASTED_MOVE_LOSS; }
function computeScore(): number { return Math.max(0, timeGain() + pairGain() - moveLoss()); }

const SCORE_PLACEHOLDER = '—';
function scoreDisplayText(): string {
  if (phase === 'over') return String(lastFinalScore);
  return SCORE_PLACEHOLDER;
}

function goMenuMM(): void {
  abortRound();
  setPhase('menu');
  void refreshTournamentPanel();
}

function setPhase(next: Phase): void {
  const prev = phase;
  phase = next;
  if (next === 'menu') showMenu();
  else showGame();
  const playframe = $('#memory-match-wrapper');
  playframe.classList.toggle('mm-ended', next === 'over');
  $('#mmCloseBtn').classList.toggle('hidden', next === 'menu');
  pauseBtn.classList.toggle('hidden', next !== 'playing');
  resumeBtn.classList.toggle('hidden', next !== 'paused');
  restartBtn.classList.toggle('hidden', next !== 'paused');
  grid.classList.toggle('mm-paused', next === 'paused');
  syncAttemptsUi();
  if (next !== 'menu' && prev === 'menu') pushShellHistory();
  if (next === 'paused' && prev !== 'paused') pushShellHistory();
  if (next === 'over' && prev !== 'over') pushShellHistory();
  if (next === 'over') refreshStats();
}

function hideOverOverlay(): void {
  const overlay = $('#mmOverOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function getOverlay(): string | null {
  const pause = document.getElementById('pauseOverlay') ??
    (resumeBtn.closest('.mm-actions')?.querySelector('#mm-resume-btn:not(.hidden)') ? 'paused' : null);
  if (typeof pause === 'string') return pause;
  if (phase === 'over') return 'over';
  if (phase === 'paused') return 'paused';
  return null;
}

const navHandlers: FreeShellNavHandlers = {
  getPhase: () => phase,
  getOverlay,
  goMenu: goMenuMM,
  resumePlaying: () => resumeRound(),
};

async function refreshTournamentPanel(): Promise<void> {
  await refreshTournamentMenuPanel(GAME_ID, $('#mmTourney'), { boardLimit: 5 });
  syncAttemptsUi();
}

async function submitRound(score: number, cleared: boolean, durationMs: number): Promise<void> {
  await submitTournamentRound(host, GAME_ID, score, cleared, durationMs, rankedThisRun, {
    rewardEl: $('#mmRunReward'),
    boardEl: $('#mmBoardOver'),
    cssPrefix: 'mm-rr',
    boardLimit: 5,
    showToast: () => { /* silent end screen */ },
    onBest: (_best, isRecord) => {
      if (isRecord) bumpScoreStat();
    },
    onSync: () => {
      syncAttemptsUi();
      void refreshTournamentPanel();
    },
  });
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function popStat(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('mm-stat-pop');
  void el.offsetWidth;
  el.classList.add('mm-stat-pop');
}

function refreshStats(): void {
  const spent = spentSeconds();
  const secs = phase === 'over' ? spent : Math.max(0, secondsLeft);
  timeEl.textContent = fmtTime(secs);
  movesEl.textContent = String(moves);
  pairsEl.textContent = `${pairs}/${PAIR_COUNT}`;
  scoreEl.textContent = scoreDisplayText();

  const fill = $('#mm-timer-fill');
  const fillPct = phase === 'over'
    ? (spent / ROUND_SECONDS) * 100
    : (Math.max(0, secondsLeft) / ROUND_SECONDS) * 100;
  fill.style.width = `${fillPct}%`;
  const bar = fill.parentElement!;
  bar.classList.toggle('mm-timer-low', phase !== 'over' && secs > 0 && secs <= 30);
  bar.classList.toggle('mm-timer-critical', phase !== 'over' && secs > 0 && secs <= 10);
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

function setCardBack(card: HTMLElement): void {
  const front = card.querySelector<HTMLElement>('.mm-card-front');
  if (front) front.innerHTML = '';
  card.classList.remove('flipped', 'mm-match-fail');
}

function setCardFace(card: HTMLElement, iconId: string): void {
  const icon = ICON_BY_ID.get(iconId);
  const front = card.querySelector<HTMLElement>('.mm-card-front');
  if (!icon || !front) return;
  front.innerHTML = `<img class="mm-card-img" src="${icon.src}" alt="${icon.alt}" draggable="false" />`;
}

function revealCard(card: HTMLElement): void {
  setCardFace(card, card.dataset.e!);
  card.classList.add('flipped');
}

function hideCard(card: HTMLElement): void {
  setCardBack(card);
  card.classList.remove('flipped');
}

function buildBoard(): void {
  cards = shuffle([...CARD_ICONS.map((icon) => icon.id), ...CARD_ICONS.map((icon) => icon.id)]);
  flipped = [];
  moves = 0;
  pairs = 0;
  grid.innerHTML = '';
  cards.forEach((iconId, i) => {
    const card = document.createElement('div');
    card.className = 'mm-card';
    card.dataset.i = String(i);
    card.dataset.e = iconId;
    card.innerHTML = `
      <div class="mm-card-inner">
        <div class="mm-card-face mm-card-front"></div>
        <div class="mm-card-face mm-card-back"><span class="mm-card-back-mark" aria-hidden="true">?</span></div>
      </div>`;
    setCardBack(card);
    card.addEventListener('click', () => flipCard(card));
    grid.appendChild(card);
  });
  refreshStats();
}

function revealAll(show: boolean): void {
  document.querySelectorAll<HTMLElement>('.mm-card').forEach((card) => {
    if (card.classList.contains('matched')) return;
    if (show) revealCard(card);
    else if (!flipped.includes(card)) hideCard(card);
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
    await promptTournamentEntry(GAME_ID, () => { void refreshTournamentPanel(); }, () => { void onPlayOrEnter(); });
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
    syncAttemptsUi();
    void refreshTournamentPanel();
  } finally {
    starting = false;
  }
}

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
    roundStartMs = performance.now();
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

async function restartRoundMM(): Promise<void> {
  if (phase !== 'paused') return;
  abortRound();
  hideOverOverlay();
  await beginRankedRound();
}

function tick(seq: number): void {
  if (seq !== roundSeq || phase !== 'playing') return;
  secondsLeft -= 1;
  refreshStats();
  if (secondsLeft === 10 || secondsLeft === 5) mmSfx.timeWarning();
  if (secondsLeft <= 0) endRound();
}

function endRound(): void {
  if (phase !== 'playing' && phase !== 'paused') return;
  const cleared = pairs === PAIR_COUNT;
  if (!cleared) playSfx('lose');
  const durationMs = roundStartMs > 0 ? Math.floor(performance.now() - roundStartMs) : spentSeconds() * 1000;
  abortRound();
  lastFinalScore = computeScore();
  setPhase('over');
  scoreEl.textContent = String(lastFinalScore);
  bumpScoreStat();
  refreshStats();
  void submitRound(lastFinalScore, cleared, durationMs);
}

function flipCard(card: HTMLElement): void {
  if (phase !== 'playing' || !canFlip || card.classList.contains('flipped') || card.classList.contains('matched')) return;
  playSfx('flip');
  revealCard(card);
  flipped.push(card);
  if (flipped.length === 2) {
    moves++;
    canFlip = false;
    popStat('mm-stat-moves');
    checkMatch();
  }
  refreshStats();
}

function checkMatch(): void {
  const [c1, c2] = flipped;
  if (c1.dataset.e === c2.dataset.e) {
    c1.classList.add('matched', 'mm-match-success');
    c2.classList.add('matched', 'mm-match-success');
    spawnMatchVfx(c1);
    spawnMatchVfx(c2);
    showScorePopup(`+${PAIR_GAIN}`, grid);
    pairs++;
    flipped = [];
    canFlip = true;
    playSfx('match');
    popStat('mm-stat-pairs');
    refreshStats();
    if (pairs === PAIR_COUNT) { playSfx('win'); endRound(); }
  } else {
    playSfx('nomatch');
    c1.classList.add('mm-match-fail');
    c2.classList.add('mm-match-fail');
    setTimeout(() => {
      if (phase !== 'playing') return;
      hideCard(c1);
      hideCard(c2);
      c1.classList.remove('mm-match-fail');
      c2.classList.remove('mm-match-fail');
      flipped = [];
      canFlip = true;
      refreshStats();
    }, 900);
  }
}

startBtn.addEventListener('click', () => { playSfx('click'); void onPlayOrEnter(); });
pauseBtn.addEventListener('click', () => { playSfx('click'); pauseRound(); });
resumeBtn.addEventListener('click', () => { playSfx('click'); resumeRound(); });
restartBtn.addEventListener('click', () => { playSfx('click'); void restartRoundMM(); });

const muteBtn = $('#mmMuteBtn') as HTMLButtonElement;

function syncMuteBtn(): void {
  const muted = mmSfx.isMuted();
  muteBtn.classList.toggle('is-muted', muted);
  muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
}
muteBtn.addEventListener('click', () => { mmSfx.toggleMute(); syncMuteBtn(); });

const stage = document.getElementById('stage');
if (stage) {
  wireFreeShellCloseButtons(stage, navHandlers);
  wireFreeShellBackNavigation(navHandlers);
}

document.documentElement.lang = getLang();
applyTranslations();
syncMuteBtn();
setPhase('menu');

void refreshTournamentPanel();
