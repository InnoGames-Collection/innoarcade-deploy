// Slide Puzzle — classic 15-puzzle. Native GoPlay brain game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import './polish.css';
import { el, finishLQRound, mulberry32, mountLQ, setLQHeader, modal } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';
import { freeGameBestRemote } from '../../platform/backend';
import { slidePuzzleScramble, slidePuzzleSolved } from '../_lq/solvable';
import { sfx } from '../../engine/audio';
import { goHub } from '../../platform/freeShellNav';
import { t } from '../../i18n';
import { slideSound } from './audio';
import {
  animateCountUp,
  bumpStat,
  comboFeedback,
  efficiencyRating,
  wireHudRow,
  ensureScorePop,
  formatElapsed,
  initBgParticles,
  showFeedback,
} from './ui';

const SIZE = 4;
const LEVELS = 5;
const host = createHost('slide-puzzle');

let sessionPaused = false;
let pauseStarted = 0;
let pausedAccum = 0;
let timerId: ReturnType<typeof setInterval> | null = null;
let sessionStartMs = 0;
let serverBest = 0;
let sessionTotalMoves = 0;

interface SlideAnim {
  value: number;
  dx: number;
  dy: number;
  glow: boolean;
}

function elapsedSessionMs(): number {
  if (sessionPaused) return pauseStarted - sessionStartMs - pausedAccum;
  return Date.now() - sessionStartMs - pausedAccum;
}

function updateSessionHud(extra: Record<string, string> = {}): void {
  setLQHeader({
    time: formatElapsed(elapsedSessionMs()),
    best: serverBest > 0 ? serverBest.toLocaleString() : '—',
    ...extra,
  });
}

function startSessionTimer(): void {
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    if (!sessionPaused) updateSessionHud();
  }, 1000);
}

function stopSessionTimer(): void {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function openSettingsModal(): void {
  slideSound('menu');
  const muteLabel = sfx.muted ? '🔇 Sound off' : '🔊 Sound on';
  modal({
    title: 'Settings',
    body: 'Adjust your puzzle experience.',
    actions: [
      { label: muteLabel, onClick: () => { sfx.toggleMute(); } },
      { label: 'Close', primary: true },
    ],
  });
}

function openHowToModal(): void {
  slideSound('menu');
  modal({
    title: 'How to Play',
    body: t('lq.help.slide-puzzle'),
    actions: [{ label: 'Got it', primary: true }],
  });
}

function openLeaderboardNotice(): void {
  slideSound('menu');
  modal({
    title: 'Leaderboard',
    body: 'National rankings will appear here when tournament play launches on Ethio Telecom GoPlay.',
    actions: [{ label: 'OK', primary: true }],
  });
}

function populateResultScreen(
  totalScore: number,
  sessionMs: number,
  moves: number,
  rating: string,
): void {
  const timeEl = document.getElementById('spOverTime');
  const movesEl = document.getElementById('spOverMoves');
  const ratingEl = document.getElementById('spOverRating');
  const rankEl = document.getElementById('spOverRank');
  const scoreEl = document.getElementById('finalScore');
  if (timeEl) timeEl.textContent = formatElapsed(sessionMs);
  if (movesEl) movesEl.textContent = moves.toLocaleString();
  if (ratingEl) ratingEl.textContent = rating;
  if (rankEl) rankEl.textContent = '—';
  if (scoreEl) animateCountUp(scoreEl, totalScore);
}

function wireShellMenu(): void {
  const startBtn = document.getElementById('startBtn');
  const triggerPlay = (): void => {
    slideSound('menu');
    startBtn?.click();
  };

  document.getElementById('spPlayBtn')?.addEventListener('click', triggerPlay);
  document.getElementById('spDailyBtn')?.addEventListener('click', triggerPlay);
  document.getElementById('spSettingsBtn')?.addEventListener('click', openSettingsModal);
  document.getElementById('spHowToBtn')?.addEventListener('click', openHowToModal);
  document.getElementById('spLeaderMenuBtn')?.addEventListener('click', openLeaderboardNotice);
  document.getElementById('spLeaderBtn')?.addEventListener('click', openLeaderboardNotice);
  document.getElementById('spHomeBtn')?.addEventListener('click', () => {
    slideSound('menu');
    goHub();
  });

  document.getElementById('spSettingsHudBtn')?.addEventListener('click', openSettingsModal);
}

function render(mountEl: HTMLElement): void {

  let levelIdx = 0;
  let totalScore = 0;
  let tiles: number[] = [];
  let moves = 0;
  let locked = false;
  let levelStart = 0;
  let combo = 0;
  let levelComboBonus = 0;
  let slideAnim: SlideAnim | null = null;
  const solved = slidePuzzleSolved(SIZE);

  sessionStartMs = Date.now();
  pausedAccum = 0;
  sessionPaused = false;
  sessionTotalMoves = 0;
  startSessionTimer();

  function loadLevel(): void {
    tiles = slidePuzzleScramble(SIZE, 14 + levelIdx * 16, mulberry32(levelIdx * 997 + 3));
    moves = 0;
    locked = false;
    levelStart = Date.now();
    combo = 0;
    levelComboBonus = 0;
    slideAnim = null;
    updateSessionHud({
      round: `${levelIdx + 1}/${LEVELS}`,
      moves: String(moves),
      score: totalScore.toLocaleString(),
    });
    paint();
  }

  function tryMove(i: number): void {
    if (locked) return;
    const empty = tiles.indexOf(0);
    const er = Math.floor(empty / SIZE);
    const ec = empty % SIZE;
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    if (Math.abs(er - r) + Math.abs(ec - c) !== 1) return;

    const movingVal = tiles[i];
    const dx = ec - c;
    const dy = er - r;
    [tiles[empty], tiles[i]] = [tiles[i], tiles[empty]];
    moves++;
    sessionTotalMoves++;

    const correct = movingVal !== 0 && solved[empty] === movingVal;
    let feedback: string | null = null;
    if (correct) {
      combo++;
      levelComboBonus += combo * 6;
      slideAnim = { value: movingVal, dx, dy, glow: true };
      slideSound('good');
      feedback = comboFeedback(combo);
    } else {
      combo = 0;
      slideAnim = { value: movingVal, dx, dy, glow: false };
      slideSound('slide');
    }

    bumpStat('moves');
    updateSessionHud({
      round: `${levelIdx + 1}/${LEVELS}`,
      moves: String(moves),
      score: totalScore.toLocaleString(),
    });
    paint();
    if (feedback) {
      const wrap = mountEl.querySelector('.sp-play-wrap');
      if (wrap) showFeedback(wrap as HTMLElement, feedback);
    }
    if (tiles.every((v, idx) => v === solved[idx])) finishLevel();
  }

  function paint(): void {
    mountEl.innerHTML = '';
    const wrap = el('div', { class: 'sp-play-wrap' });
    ensureScorePop(wrap);

    const frame = el('div', { class: 'sp-board-frame' });
    frame.appendChild(el('div', {
      class: 'sp-round-badge',
      html: `Puzzle <strong>${levelIdx + 1}</strong> of ${LEVELS}`,
    }));

    const grid = el('div', { class: 'sp-grid' });
    tiles.forEach((v, i) => {
      const classes = ['sp-tile'];
      if (v === 0) {
        classes.push('empty');
      } else if (slideAnim && slideAnim.value === v) {
        classes.push('sp-tile--slide');
        if (slideAnim.glow) classes.push('sp-tile--glow');
      }
      const btn = el('button', {
        type: 'button',
        class: classes.join(' '),
        ...(v === 0 ? { disabled: '' } : {}),
        onclick: () => tryMove(i),
      }, v === 0 ? '' : el('span', { text: String(v) }));
      if (slideAnim && slideAnim.value === v) {
        btn.style.setProperty('--sp-dx', String(slideAnim.dx));
        btn.style.setProperty('--sp-dy', String(slideAnim.dy));
      }
      grid.appendChild(btn);
    });
    frame.appendChild(grid);
    wrap.appendChild(frame);
    mountEl.appendChild(wrap);
    slideAnim = null;
  }

  function finishLevel(): void {
    if (locked) return;
    locked = true;
    slideSound('win');
    const par = 10 + (levelIdx + 1) * 15;
    const elapsedMs = Date.now() - levelStart;
    const moveBonus = Math.max(0, par - moves) * 8;
    const levelScore = puzzleCompletionScore(elapsedMs, 0, { budgetSec: 420, base: 80 })
      + moveBonus
      + levelComboBonus;
    totalScore += levelScore;
    levelIdx++;

    bumpStat('score');
    updateSessionHud({
      round: `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`,
      score: totalScore.toLocaleString(),
    });

    if (levelIdx >= LEVELS) {
      stopSessionTimer();
      const sessionMs = elapsedSessionMs();
      const totalPar = Array.from({ length: LEVELS }, (_, i) => 10 + (i + 1) * 15)
        .reduce((a, b) => a + b, 0);
      const rating = efficiencyRating(sessionTotalMoves, totalPar, sessionMs);
      slideSound('victory');
      finishLQRound(totalScore, totalScore >= host.winScore, `${LEVELS}/${LEVELS} puzzles`, sessionMs);
      setTimeout(() => populateResultScreen(totalScore, sessionMs, sessionTotalMoves, rating), 80);
    } else {
      window.setTimeout(loadLevel, 700);
    }
  }

  loadLevel();
}

mountLQ('slide-puzzle', render, {
  headerSlots: [
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
    { id: 'moves', labelKey: 'ws.moves', icon: 'moves' },
    { id: 'time', labelKey: 'tg.time', icon: 'timer' },
    { id: 'best', labelKey: 'td.best', icon: 'score' },
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
  ],
  pauseable: true,
  onPause: () => {
    sessionPaused = true;
    pauseStarted = Date.now();
  },
  onResume: () => {
    if (sessionPaused) pausedAccum += Date.now() - pauseStarted;
    sessionPaused = false;
  },
  onAbandon: () => stopSessionTimer(),
});

initBgParticles();
wireShellMenu();
wireHudRow();

void freeGameBestRemote(host.meta.id).then((best) => {
  serverBest = best;
});
