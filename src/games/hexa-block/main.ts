// Hexa Block — place hex clusters on a honeycomb board; clear full rows.
import '../../styles/base.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, mulberry32, sound, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { createHost } from '../../platform/gameHost';
import { showFirstRunHint } from '../_shared/firstRun';

const ROWS = 7;
const COLORS = ['#5b8cff', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6'];

const SHAPES: [number, number][][] = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1]],
];

interface Piece { cells: [number, number][]; color: string; used: boolean; }

const host = createHost('hexa-block');

function rowWidth(r: number): number {
  return r % 2 === 0 ? 5 : 4;
}

function canPlace(grid: (string | null)[][], cells: [number, number][], br: number, bc: number): boolean {
  for (const [dr, dc] of cells) {
    const r = br + dr;
    const c = bc + dc;
    if (r < 0 || r >= ROWS) return false;
    const w = rowWidth(r);
    if (c < 0 || c >= w) return false;
    if (grid[r][c]) return false;
  }
  return true;
}

function place(grid: (string | null)[][], cells: [number, number][], br: number, bc: number, color: string): void {
  for (const [dr, dc] of cells) grid[br + dr][bc + dc] = color;
}

function clearRows(grid: (string | null)[][]): number {
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    const w = rowWidth(r);
    if (grid[r].slice(0, w).every((v) => v)) {
      grid[r].fill(null);
      n++;
    }
  }
  return n;
}

function anyFit(grid: (string | null)[][], pieces: Piece[]): boolean {
  for (const p of pieces) {
    if (p.used) continue;
    for (let r = 0; r < ROWS; r++) {
      const w = rowWidth(r);
      for (let c = 0; c < w; c++) {
        if (canPlace(grid, p.cells, r, c)) return true;
      }
    }
  }
  return false;
}

function piecePreviewEl(p: Piece, idx: number, selected: number | null, onSelect: () => void): HTMLElement {
  let maxR = 0;
  let maxC = 0;
  for (const [dr, dc] of p.cells) {
    maxR = Math.max(maxR, dr);
    maxC = Math.max(maxC, dc);
  }
  const pieceEl = el('div', {
    class: 'hb-piece' + (selected === idx ? ' hb-piece--sel' : ''),
    onclick: onSelect,
  });
  for (let r = 0; r <= maxR; r++) {
    const mini = el('div', { class: 'hb-row hb-row--mini' });
    for (let c = 0; c <= maxC; c++) {
      const filled = p.cells.some(([dr, dc]) => dr === r && dc === c);
      mini.appendChild(el('div', {
        class: 'hb-cell' + (filled ? ' filled' : ' hb-cell--ghost'),
        style: filled ? `background:${p.color};width:22px;height:26px` : 'width:22px;height:26px;opacity:0',
      }));
    }
    pieceEl.appendChild(mini);
  }
  return pieceEl;
}

function randomPiece(rnd: () => number): Piece {
  const shape = SHAPES[Math.floor(rnd() * SHAPES.length)];
  return {
    cells: shape.map(([r, c]) => [r, c] as [number, number]),
    color: COLORS[Math.floor(rnd() * COLORS.length)],
    used: false,
  };
}

function render(mount: HTMLElement): void {
  const rnd = mulberry32((Math.random() * 1e9) | 0);
  const grid: (string | null)[][] = [];
  for (let r = 0; r < ROWS; r++) grid[r] = Array(rowWidth(r)).fill(null);

  let pieces = [randomPiece(rnd), randomPiece(rnd), randomPiece(rnd)];
  let score = 0;
  let lines = 0;
  let selected: number | null = null;
  const t0 = Date.now();

  const wrap = el('div', { class: 'hb-wrap' });
  const hint = el('p', { class: 'hb-hint', text: 'Select a hex piece, then tap the board.' });
  const boardEl = el('div', { class: 'hb-board' });
  const tray = el('div', { class: 'hb-tray' });
  wrap.appendChild(hint);
  wrap.appendChild(boardEl);
  wrap.appendChild(tray);
  mount.appendChild(wrap);

  showFirstRunHint('hexa-block', toast);

  setLQHeader({ round: '0', score: '0' });

  function previewCells(): Set<string> {
    const set = new Set<string>();
    if (selected == null) return set;
    const p = pieces[selected];
    if (p.used) return set;
    for (let r = 0; r < ROWS; r++) {
      const w = rowWidth(r);
      for (let c = 0; c < w; c++) {
        if (!canPlace(grid, p.cells, r, c)) continue;
        for (const [dr, dc] of p.cells) set.add(`${r + dr},${c + dc}`);
      }
    }
    return set;
  }

  function endRun(): void {
    finishLQRound(score, score >= host.winScore, `${lines} rows · ${score} pts`, Date.now() - t0);
  }

  function paint(): void {
    const preview = previewCells();
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      const row = el('div', { class: 'hb-row' });
      const w = rowWidth(r);
      for (let c = 0; c < w; c++) {
        const key = `${r},${c}`;
        row.appendChild(el('div', {
          class: 'hb-cell'
            + (grid[r][c] ? ' filled' : '')
            + (preview.has(key) ? ' hb-preview' : ''),
          style: grid[r][c]
            ? `background:${grid[r][c]}`
            : (preview.has(key) && selected != null ? `background:${pieces[selected].color}` : ''),
          onclick: () => onCell(r, c),
        }));
      }
      boardEl.appendChild(row);
    }

    tray.innerHTML = '';
    pieces.forEach((p, idx) => {
      if (p.used) return;
      tray.appendChild(piecePreviewEl(p, idx, selected, () => {
        selected = idx;
        sound('click');
        paint();
      }));
    });

    setLQHeader({ round: String(lines), score: String(score) });
  }

  function onCell(r: number, c: number): void {
    if (selected == null) { toast('Select a piece'); return; }
    const p = pieces[selected];
    if (p.used || !canPlace(grid, p.cells, r, c)) { sound('bad'); return; }
    place(grid, p.cells, r, c, p.color);
    p.used = true;
    const cleared = clearRows(grid);
    if (cleared) { lines += cleared; score += cleared * 15; sound('win'); }
    else sound('good');
    if (pieces.every((x) => x.used)) pieces = [randomPiece(rnd), randomPiece(rnd), randomPiece(rnd)];
    selected = null;
    paint();
    if (!anyFit(grid, pieces)) endRun();
  }

  paint();
}

mountLQ('hexa-block', render, {
  headerSlots: [
    { id: 'round', labelKey: 'hb.rows', icon: 'round' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
