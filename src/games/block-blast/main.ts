// Block Blast — place polyomino pieces on an 8×8 grid; clear full rows and columns.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, mulberry32, sound, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { createHost } from '../../platform/gameHost';
import { showFirstRunHint } from '../_shared/firstRun';

const SIZE = 8;
const COLORS = ['#5b8cff', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c'];

const SHAPES: [number, number][][] = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
];

interface Piece {
  cells: [number, number][];
  color: string;
  used: boolean;
}

const host = createHost('block-blast');

function normCells(cells: [number, number][]): [number, number][] {
  const minR = Math.min(...cells.map((c) => c[0]));
  const minC = Math.min(...cells.map((c) => c[1]));
  return cells.map(([r, c]) => [r - minR, c - minC] as [number, number]);
}

function randomPiece(rnd: () => number): Piece {
  const shape = SHAPES[Math.floor(rnd() * SHAPES.length)];
  const color = COLORS[Math.floor(rnd() * COLORS.length)];
  return { cells: normCells(shape), color, used: false };
}

function canPlace(grid: (string | null)[][], cells: [number, number][], br: number, bc: number): boolean {
  for (const [r, c] of cells) {
    const nr = br + r;
    const nc = bc + c;
    if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE) return false;
    if (grid[nr][nc]) return false;
  }
  return true;
}

function place(grid: (string | null)[][], cells: [number, number][], br: number, bc: number, color: string): void {
  for (const [r, c] of cells) grid[br + r][bc + c] = color;
}

function clearLines(grid: (string | null)[][]): number {
  let cleared = 0;
  for (let r = 0; r < SIZE; r++) {
    if (grid[r].every((v) => v)) { grid[r].fill(null); cleared++; }
  }
  for (let c = 0; c < SIZE; c++) {
    if (grid.every((row) => row[c])) {
      for (let r = 0; r < SIZE; r++) grid[r][c] = null;
      cleared++;
    }
  }
  return cleared;
}

function anyFit(grid: (string | null)[][], pieces: Piece[]): boolean {
  for (const p of pieces) {
    if (p.used) continue;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (canPlace(grid, p.cells, r, c)) return true;
    }
  }
  return false;
}

function render(mount: HTMLElement): void {
  const rnd = mulberry32((Math.random() * 1e9) | 0);
  const grid: (string | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  let pieces = [randomPiece(rnd), randomPiece(rnd), randomPiece(rnd)];
  let score = 0;
  let selected: number | null = null;
  let combo = 0;
  const t0 = Date.now();

  const wrap = el('div', { class: 'bb-wrap' });
  const hint = el('p', { class: 'bb-hint', text: 'Select a piece, then tap the board to place it.' });
  const gridEl = el('div', { class: 'bb-grid' });
  const tray = el('div', { class: 'bb-tray' });
  wrap.appendChild(hint);
  wrap.appendChild(gridEl);
  wrap.appendChild(tray);
  mount.appendChild(wrap);

  showFirstRunHint('block-blast', toast);

  setLQHeader({ round: '0', score: '0' });

  function previewCells(): Set<string> {
    const set = new Set<string>();
    if (selected == null) return set;
    const p = pieces[selected];
    if (p.used) return set;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!canPlace(grid, p.cells, r, c)) continue;
        for (const [dr, dc] of p.cells) set.add(`${r + dr},${c + dc}`);
      }
    }
    return set;
  }

  function endRun(): void {
    const ms = Date.now() - t0;
    finishLQRound(score, score >= host.winScore, `${score} pts · ${combo} lines`, ms);
  }

  function refillTray(): void {
    if (pieces.every((p) => p.used)) pieces = [randomPiece(rnd), randomPiece(rnd), randomPiece(rnd)];
    selected = null;
  }

  function paint(): void {
    const preview = previewCells();
    gridEl.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = el('div', {
          class: 'bb-cell'
            + (grid[r][c] ? ' filled' : '')
            + (preview.has(`${r},${c}`) ? ' preview' : ''),
          style: grid[r][c] ? `background:${grid[r][c]}` : (preview.has(`${r},${c}`) && selected != null ? `background:${pieces[selected!].color}` : ''),
          onclick: () => onCell(r, c),
        });
        gridEl.appendChild(cell);
      }
    }

    tray.innerHTML = '';
    pieces.forEach((p, idx) => {
      if (p.used) return;
      const maxR = Math.max(...p.cells.map((x) => x[0]));
      const maxC = Math.max(...p.cells.map((x) => x[1]));
      const pieceEl = el('div', {
        class: 'bb-piece' + (selected === idx ? ' bb-piece--sel' : ''),
        style: `grid-template-rows:repeat(${maxR + 1},14px);grid-template-columns:repeat(${maxC + 1},14px)`,
        onclick: () => { selected = idx; sound('click'); paint(); },
      });
      for (const [r, c] of p.cells) {
        const pc = el('div', { class: 'bb-pcell', style: `background:${p.color};grid-row:${r + 1};grid-column:${c + 1}` });
        pieceEl.appendChild(pc);
      }
      tray.appendChild(pieceEl);
    });

    setLQHeader({ round: String(combo), score: String(score) });
  }

  function onCell(r: number, c: number): void {
    if (selected == null) { toast('Select a piece first'); return; }
    const p = pieces[selected];
    if (p.used) return;
    if (!canPlace(grid, p.cells, r, c)) { sound('bad'); toast('Cannot place here'); return; }
    place(grid, p.cells, r, c, p.color);
    p.used = true;
    const lines = clearLines(grid);
    if (lines > 0) {
      combo += lines;
      score += lines * 10 + (lines > 1 ? lines * 5 : 0);
      gridEl.classList.add('bb-clear-flash');
      window.setTimeout(() => gridEl.classList.remove('bb-clear-flash'), 350);
      sound('win');
    } else {
      sound('good');
    }
    refillTray();
    paint();
    if (!anyFit(grid, pieces)) endRun();
  }

  paint();
}

mountLQ('block-blast', render, {
  headerSlots: [
    { id: 'round', labelKey: 'bb.lines', icon: 'round' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
