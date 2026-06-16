// Mini Sudoku — 6×6 grid, 2×3 boxes, uniqueness-checked puzzles. Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import { el, toast, modal, recordResult, mulberry32, dayNumber, shuffled, sound, mountLQ } from '../_lq/lq';

const N = 6, BR = 2, BC = 3;
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

function render(mount: HTMLElement): void {
  let cleanup: (() => void) | null = null;
  let difficulty: 'easy' | 'hard' = 'easy';

  function newRound(seed: number): void {
    if (cleanup) cleanup();
    mount.innerHTML = '';
    cleanup = startRound(seed);
  }

  function startRound(seed: number): () => void {
    const rnd = mulberry32(seed);
    const { puzzle, solution } = makePuzzle(rnd, difficulty === 'hard' ? 22 : 16);
    const board = puzzle.map((row) => row.slice());
    let sel: [number, number] | null = null;
    let over = false;
    const t0 = Date.now();

    const gridEl = el('div', { class: 'sudoku', role: 'grid', style: `grid-template-columns: repeat(${N}, auto);` });
    const cellEls: HTMLElement[][] = [];
    for (let r = 0; r < N; r++) {
      cellEls.push([]);
      for (let c = 0; c < N; c++) {
        const given = puzzle[r][c] !== 0;
        const cell = el('div', {
          class: 'cell' + (given ? ' given' : '') + ((c + 1) % BC === 0 && c < N - 1 ? ' box-r' : '') + ((r + 1) % BR === 0 && r < N - 1 ? ' box-b' : ''),
          role: 'gridcell', text: given ? String(puzzle[r][c]) : '',
          onclick: () => { if (!given && !over) { sel = [r, c]; paint(); } },
        });
        cellEls[r].push(cell);
        gridEl.appendChild(cell);
      }
    }

    const pad = el('div', { class: 'kbd' },
      el('div', { class: 'kbd-row' },
        [1, 2, 3, 4, 5, 6].map((v) => el('button', { class: 'key num', text: String(v), onclick: () => place(v) })),
        el('button', { class: 'key wide', text: '⌫', onclick: () => place(0) })));

    const diffBtn = el('button', {
      class: 'btn', text: 'Difficulty: ' + difficulty,
      onclick: () => { difficulty = difficulty === 'easy' ? 'hard' : 'easy'; newRound(Math.floor(Math.random() * 1e9)); },
    });

    mount.appendChild(el('div', { class: 'game-toolbar' },
      el('button', { class: 'btn', text: 'How to play', onclick: showHelp }),
      diffBtn,
      el('button', { class: 'btn', text: 'New puzzle', onclick: () => newRound(Math.floor(Math.random() * 1e9)) })));
    mount.appendChild(gridEl);
    mount.appendChild(pad);

    function showHelp(): void {
      modal({ title: 'How to play', body: `<b>Goal:</b> fill the grid so every <b>row</b>, <b>column</b>, and outlined
        <b>2×3 box</b> contains the digits 1-6 exactly once.<br><br>
        1. Tap an empty cell (gray ones are given clues).<br>
        2. Tap a number — or press 1-6. ⌫ erases.<br>
        3. A red number clashes with its row, column, or box.<br><br>
        Every puzzle has <b>exactly one solution</b>.` });
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
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cell = cellEls[r][c];
        if (puzzle[r][c] === 0) cell.textContent = board[r][c] ? String(board[r][c]) : '';
        cell.classList.toggle('sel', !!sel && sel[0] === r && sel[1] === c);
        cell.classList.toggle('conflict', puzzle[r][c] === 0 && conflicts(r, c, board[r][c]));
      }
    }

    function place(v: number): void {
      if (!sel || over) { toast('Tap an empty cell first'); return; }
      board[sel[0]][sel[1]] = v;
      if (v) sound('click');
      paint();
      checkDone();
    }

    function checkDone(): void {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] !== solution[r][c]) return;
      over = true;
      const secs = Math.round((Date.now() - t0) / 1000);
      sound('win');
      recordResult('sudoku', { won: true, score: Math.max(1, 30 - Math.floor(secs / 30)) });
      modal({
        title: '🎉 Solved!',
        body: `Completed the ${difficulty} puzzle in <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b>.`,
        actions: [
          { label: 'New puzzle', primary: true, onClick: () => newRound(Math.floor(Math.random() * 1e9)) },
          { label: 'Close' },
        ],
      });
    }

    function physicalKey(e: KeyboardEvent): void {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-6]$/.test(e.key)) { e.preventDefault(); place(Number(e.key)); }
      if (e.key === 'Backspace' || e.key === '0') { e.preventDefault(); place(0); }
    }
    document.addEventListener('keydown', physicalKey);
    paint();
    return () => document.removeEventListener('keydown', physicalKey);
  }

  newRound(dayNumber() * 5407 + 3);
}

mountLQ('sudoku', render);
