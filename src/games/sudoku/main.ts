// Mini Sudoku — 6×6 grid, 2×3 boxes, uniqueness-checked puzzles. Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import './polish.css';
import { el, toast, finishLQRound, mulberry32, shuffled, mountLQ, setLQHeader, modal } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { escalateTier } from '../../platform/freeDifficulty';
import { createHost } from '../../platform/gameHost';
import { sfx } from '../../engine/audio';
import { sudokuSound } from './audio';
import {
  animateCountUp,
  bumpStat,
  ensurePlayToolbar,
  formatElapsed,
  initBgParticles,
  randomFeedback,
  showFeedback,
  spawnSparkles,
  tierLabel,
} from './ui';

const N = 6, BR = 2, BC = 3;
const PUZZLES = 3;
const host = createHost('sudoku');

let shellDifficultyLabel = 'Easy';
let sessionPaused = false;
let pauseStarted = 0;
let pausedAccum = 0;
let timerId: ReturnType<typeof setInterval> | null = null;
let sessionStartMs = 0;
let sessionMistakes = 0;
let sessionPlacements = 0;
let sessionCorrect = 0;

function boxOf(r: number, c: number): number { return Math.floor(r / BR) * (N / BC) + Math.floor(c / BC); }

function makeSolution(rnd: () => number): number[][] {
  const base = (r: number, c: number): number => (Math.floor(r / BR) + r * BC + c) % N;
  const digits = shuffled([1, 2, 3, 4, 5, 6], rnd);
  const bandOrder = shuffled([0, 1, 2], rnd);
  const rows = bandOrder.flatMap((b) => shuffled([0, 1], rnd).map((r) => b * BR + r));
  const stackOrder = shuffled([0, 1], rnd);
  const cols = stackOrder.flatMap((s) => shuffled([0, 1, 2], rnd).map((c) => s * BC + c));
  const grid: number[][] = [];
  for (let r = 0; r < N; r++) { grid.push([]); for (let c = 0; c < N; c++) grid[r].push(digits[base(rows[r], cols[c])]); }
  return grid;
}

function countSolutions(grid: number[][], limit: number): number {
  let count = 0;
  const rowsU = Array.from({ length: N }, () => new Set<number>());
  const colsU = Array.from({ length: N }, () => new Set<number>());
  const boxU = Array.from({ length: N }, () => new Set<number>());
  const empties: Array<[number, number]> = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const v = grid[r][c];
    if (v) { rowsU[r].add(v); colsU[c].add(v); boxU[boxOf(r, c)].add(v); } else empties.push([r, c]);
  }
  (function go(i: number): void {
    if (count >= limit) return;
    if (i === empties.length) { count++; return; }
    const [r, c] = empties[i], b = boxOf(r, c);
    for (let v = 1; v <= N; v++) {
      if (rowsU[r].has(v) || colsU[c].has(v) || boxU[b].has(v)) continue;
      rowsU[r].add(v); colsU[c].add(v); boxU[b].add(v);
      go(i + 1);
      rowsU[r].delete(v); colsU[c].delete(v); boxU[b].delete(v);
      if (count >= limit) return;
    }
  })(0);
  return count;
}

function makePuzzle(rnd: () => number, removals: number): { puzzle: number[][]; solution: number[][] } {
  const solution = makeSolution(rnd);
  const puzzle = solution.map((row) => row.slice());
  const cells = shuffled(Array.from({ length: N * N }, (_, i) => [Math.floor(i / N), i % N] as [number, number]), rnd);
  let removed = 0;
  for (const [r, c] of cells) {
    if (removed >= removals) break;
    const keep = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(puzzle.map((x) => x.slice()), 2) !== 1) puzzle[r][c] = keep; else removed++;
  }
  return { puzzle, solution };
}

function elapsedSessionMs(): number {
  if (sessionPaused) return pauseStarted - sessionStartMs - pausedAccum;
  return Date.now() - sessionStartMs - pausedAccum;
}

function updateSessionHud(extra: Record<string, string> = {}): void {
  setLQHeader({
    time: formatElapsed(elapsedSessionMs()),
    mistakes: String(sessionMistakes),
    difficulty: shellDifficultyLabel,
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
  sudokuSound('menu');
  const muteLabel = sfx.muted ? '🔇 Sound off' : '🔊 Sound on';
  modal({
    title: 'Settings',
    body: 'Adjust your Sudoku experience.',
    actions: [
      {
        label: muteLabel,
        onClick: () => { sfx.toggleMute(); },
      },
      { label: 'Close', primary: true },
    ],
  });
}

function openLeaderboardNotice(): void {
  sudokuSound('menu');
  modal({
    title: 'Leaderboard',
    body: 'National rankings will appear here when tournament play launches on Ethio Telecom GoPlay.',
    actions: [{ label: 'OK', primary: true }],
  });
}

function populateResultScreen(totalScore: number, sessionMs: number): void {
  const accuracy = sessionPlacements > 0
    ? `${Math.round((sessionCorrect / sessionPlacements) * 100)}%`
    : '100%';
  const timeEl = document.getElementById('sdkOverTime');
  const accEl = document.getElementById('sdkOverAccuracy');
  const misEl = document.getElementById('sdkOverMistakes');
  const diffEl = document.getElementById('sdkOverDifficulty');
  const scoreEl = document.getElementById('finalScore');
  if (timeEl) timeEl.textContent = formatElapsed(sessionMs);
  if (accEl) accEl.textContent = accuracy;
  if (misEl) misEl.textContent = String(sessionMistakes);
  if (diffEl) diffEl.textContent = shellDifficultyLabel;
  if (scoreEl) animateCountUp(scoreEl, totalScore);
}

function wireShellMenu(): void {
  const startBtn = document.getElementById('startBtn');
  const triggerPlay = (): void => {
    sudokuSound('menu');
    startBtn?.click();
  };

  document.getElementById('sdkPlayBtn')?.addEventListener('click', triggerPlay);
  document.getElementById('sdkDailyBtn')?.addEventListener('click', triggerPlay);

  document.querySelectorAll<HTMLElement>('.sdk-diff-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.sdk-diff-chip').forEach((c) => c.classList.remove('sdk-diff-chip--active'));
      chip.classList.add('sdk-diff-chip--active');
      const diff = chip.dataset.sdkDiff;
      shellDifficultyLabel = diff === 'hard' ? 'Hard' : diff === 'medium' ? 'Medium' : 'Easy';
      sudokuSound('select');
    });
  });

  document.getElementById('sdkSettingsBtn')?.addEventListener('click', openSettingsModal);
  document.getElementById('sdkLeaderMenuBtn')?.addEventListener('click', openLeaderboardNotice);
  document.getElementById('sdkLeaderBtn')?.addEventListener('click', openLeaderboardNotice);
  document.getElementById('sdkHomeBtn')?.addEventListener('click', () => {
    sudokuSound('menu');
    if (history.length > 1) history.back();
    else location.href = '../../';
  });

  document.getElementById('fcPlayFrame')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#sdkSettingsPlayBtn')) openSettingsModal();
  });
}

function render(mount: HTMLElement): void {
  ensurePlayToolbar();

  function startSession(seed: number): void {
    const rnd = mulberry32(seed);
    let puzzleIdx = 0;
    let totalScore = 0;
    sessionStartMs = Date.now();
    pausedAccum = 0;
    sessionPaused = false;
    sessionMistakes = 0;
    sessionPlacements = 0;
    sessionCorrect = 0;
    startSessionTimer();
    let puzzleCleanup: (() => void) | null = null;

    function loadPuzzle(): void {
      if (puzzleCleanup) puzzleCleanup();
      mount.innerHTML = '';

      const tier = escalateTier(puzzleIdx, 2, 1);
      const removals = 16 + tier * 2;
      const { puzzle, solution } = makePuzzle(rnd, removals);
      const board = puzzle.map((row) => row.slice());
      let sel: [number, number] | null = null;
      let activeNum: number | null = null;
      let over = false;
      const puzzleStart = Date.now();

      const playWrap = el('div', { class: 'sdk-play-wrap' });
      const boardFrame = el('div', { class: 'sdk-board-frame' });
      const scorePop = el('div', { class: 'sdk-score-pop', 'aria-hidden': 'true' });
      const gridEl = el('div', { class: 'sudoku', role: 'grid' });
      const cellEls: HTMLElement[][] = [];
      const numKeys: HTMLButtonElement[] = [];

      for (let r = 0; r < N; r++) {
        cellEls.push([]);
        for (let c = 0; c < N; c++) {
          const given = puzzle[r][c] !== 0;
          const cell = el('div', {
            class: 'cell' + (given ? ' given' : '') + ((c + 1) % BC === 0 && c < N - 1 ? ' box-r' : '') + ((r + 1) % BR === 0 && r < N - 1 ? ' box-b' : ''),
            role: 'gridcell', text: given ? String(puzzle[r][c]) : '',
            onclick: () => {
              if (!given && !over) {
                sel = [r, c];
                sudokuSound('select');
                paint();
              }
            },
          });
          cellEls[r].push(cell);
          gridEl.appendChild(cell);
        }
      }

      boardFrame.appendChild(gridEl);
      boardFrame.appendChild(scorePop);

      const pad = el('div', { class: 'kbd sudoku-kbd' },
        el('div', { class: 'kbd-row' },
          [1, 2, 3, 4, 5, 6].map((v) => {
            const btn = el('button', {
              class: 'key num',
              text: String(v),
              onclick: () => { activeNum = v; paintPad(); place(v); },
            }) as HTMLButtonElement;
            numKeys.push(btn);
            return btn;
          }),
          el('button', { class: 'key wide', text: '⌫', onclick: () => place(0) })));

      playWrap.appendChild(boardFrame);
      playWrap.appendChild(pad);
      mount.appendChild(playWrap);

      updateSessionHud({
        round: `${puzzleIdx + 1}/${PUZZLES}`,
        score: String(totalScore),
        difficulty: tierLabel(tier),
      });

      function paintPad(): void {
        numKeys.forEach((btn, i) => {
          btn.classList.toggle('num--active', activeNum === i + 1);
        });
      }

      function conflicts(r: number, c: number, v: number): boolean {
        if (!v) return false;
        for (let i = 0; i < N; i++) {
          if (i !== c && board[r][i] === v) return true;
          if (i !== r && board[i][c] === v) return true;
        }
        const br = Math.floor(r / BR) * BR, bc = Math.floor(c / BC) * BC;
        for (let i = br; i < br + BR; i++) for (let j = bc; j < bc + BC; j++) {
          if ((i !== r || j !== c) && board[i][j] === v) return true;
        }
        return false;
      }

      function paint(): void {
        const selBox = sel ? boxOf(sel[0], sel[1]) : -1;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const cell = cellEls[r][c];
          if (puzzle[r][c] === 0) cell.textContent = board[r][c] ? String(board[r][c]) : '';
          const isSel = !!sel && sel[0] === r && sel[1] === c;
          const peer = !!sel && !isSel && (r === sel[0] || c === sel[1] || boxOf(r, c) === selBox);
          cell.classList.toggle('sel', isSel);
          cell.classList.toggle('hilite', peer);
          cell.classList.toggle('hilite-peer', peer);
          cell.classList.toggle('conflict', puzzle[r][c] === 0 && conflicts(r, c, board[r][c]));
        }
        paintPad();
      }

      function place(v: number): void {
        if (!sel || over) { toast('Tap an empty cell first'); return; }
        const [r, c] = sel;
        const prev = board[r][c];
        board[r][c] = v;

        if (v) {
          sessionPlacements++;
          const correct = solution[r][c] === v;
          if (correct) {
            sessionCorrect++;
            sudokuSound('place');
            showFeedback(playWrap, randomFeedback());
          } else {
            sessionMistakes++;
            sudokuSound('bad');
            bumpStat('mistakes');
          }
          const cell = cellEls[r][c];
          cell.classList.remove('pop');
          void cell.offsetWidth;
          cell.classList.add('pop');
        } else {
          sudokuSound('click');
        }

        if (v && prev !== v) activeNum = v;
        paint();
        checkDone();
      }

      function checkDone(): void {
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] !== solution[r][c]) return;
        over = true;
        const elapsedMs = Date.now() - puzzleStart;
        sudokuSound('win');
        spawnSparkles(boardFrame, 12);
        const score = puzzleCompletionScore(elapsedMs, 0, { budgetSec: 420 });
        totalScore += score;
        puzzleIdx++;
        updateSessionHud({
          round: `${Math.min(puzzleIdx + 1, PUZZLES)}/${PUZZLES}`,
          score: String(totalScore),
        });
        bumpStat('score');
        if (puzzleIdx >= PUZZLES) {
          stopSessionTimer();
          const sessionMs = elapsedSessionMs();
          sudokuSound('victory');
          finishLQRound(
            totalScore,
            totalScore >= host.winScore,
            `${PUZZLES}/${PUZZLES} puzzles`,
            sessionMs,
          );
          setTimeout(() => populateResultScreen(totalScore, sessionMs), 80);
        } else {
          setTimeout(loadPuzzle, 600);
        }
      }

      function physicalKey(e: KeyboardEvent): void {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (/^[1-6]$/.test(e.key)) { e.preventDefault(); activeNum = Number(e.key); place(Number(e.key)); }
        if (e.key === 'Backspace' || e.key === '0') { e.preventDefault(); place(0); }
      }
      document.addEventListener('keydown', physicalKey);
      puzzleCleanup = () => document.removeEventListener('keydown', physicalKey);
      paint();
    }

    loadPuzzle();
  }

  startSession(Math.floor(Math.random() * 1e9));
}

mountLQ('sudoku', render, {
  headerSlots: [
    { id: 'time', labelKey: 'tg.time', icon: 'timer' },
    { id: 'mistakes', label: 'Mistakes', icon: 'correct' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
    { id: 'difficulty', label: 'Level', icon: 'round' },
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
