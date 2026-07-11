// Block Blast — place polyomino pieces on an 8×8 grid; clear full rows and columns.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import './polish.css';
import { el, finishLQRound, mulberry32, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { createHost } from '../../platform/gameHost';
import { showFirstRunHint } from '../_shared/firstRun';
import { gemClasses } from '../_shared/premiumGems';
import { bbSfx } from './sounds';
import { wireDrag } from './drag';
import {
  animateCountUp,
  animateHudValue,
  centerOf,
  labelForPlacement,
  launchConfetti,
  markPlacedCells,
  pulseBoard,
  shakeWrap,
  spawnParticles,
  spawnScorePopup,
  spawnSparkles,
  spawnStreak,
} from './fx';

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

function hudEl(id: string): HTMLElement | null {
  return document.getElementById(`fpStat-${id}`);
}

function readMenuBest(): number {
  const strong = document.querySelector('#freeMenu strong');
  if (!strong) return 0;
  const n = parseInt(strong.textContent?.replace(/,/g, '') ?? '0', 10);
  return Number.isFinite(n) ? n : 0;
}

function render(mount: HTMLElement): void {
  const rnd = mulberry32((Math.random() * 1e9) | 0);
  const grid: (string | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  let pieces = [randomPiece(rnd), randomPiece(rnd), randomPiece(rnd)];
  let score = 0;
  let selected: number | null = null;
  let combo = 0;
  let moves = 0;
  let highestCombo = 0;
  let sessionBest = readMenuBest();
  const t0 = Date.now();

  const wrap = el('div', { class: 'bb-wrap' });
  const fxLayer = el('div', { class: 'bb-fx-layer' });
  const hint = el('p', { class: 'bb-hint', text: 'Drag a block onto the board, or tap to select then place.' });
  const gridEl = el('div', { class: 'bb-grid pboard' });
  const tray = el('div', { class: 'bb-tray' });
  wrap.appendChild(hint);
  wrap.appendChild(gridEl);
  wrap.appendChild(tray);
  wrap.appendChild(fxLayer);
  mount.appendChild(wrap);

  showFirstRunHint('block-blast', toast);

  function updateHeader(): void {
    setLQHeader({
      score: String(score),
      best: String(sessionBest),
      round: String(combo),
      moves: String(moves),
    });
    animateHudValue(hudEl('score'), String(score));
    animateHudValue(hudEl('round'), String(combo));
    animateHudValue(hudEl('moves'), String(moves));
    if (score >= sessionBest) {
      sessionBest = score;
      animateHudValue(hudEl('best'), String(sessionBest));
    }
  }

  updateHeader();

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

  function paintRunStatsOnOver(): void {
    const linesEl = document.getElementById('bbOverLines');
    const comboEl = document.getElementById('bbOverCombo');
    const movesEl = document.getElementById('bbOverMoves');
    const resultEl = document.getElementById('bbOverResult');
    if (linesEl) linesEl.textContent = String(combo);
    if (comboEl) comboEl.textContent = `×${highestCombo}`;
    if (movesEl) movesEl.textContent = String(moves);
    if (resultEl) {
      resultEl.textContent = score >= host.winScore ? 'Victory' : 'Good try';
    }
    const finalEl = document.getElementById('finalScore');
    if (finalEl) animateCountUp(finalEl, score);
    const overPanel = document.querySelector('#overOverlay .game-panel');
    if (score >= host.winScore && overPanel) launchConfetti(overPanel as HTMLElement);
  }

  function endRun(): void {
    const ms = Date.now() - t0;
    paintRunStatsOnOver();
    if (score >= host.winScore) bbSfx.victory();
    else bbSfx.gameOver();
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
        const fill = grid[r][c];
        const previewColor = preview.has(`${r},${c}`) && selected != null && !fill
          ? pieces[selected!].color
          : null;
        let cls = 'bb-cell';
        if (fill) cls += ` filled ${gemClasses(fill, 'block')}`;
        else cls += ' pboard-slot';
        if (previewColor) cls += ` ${gemClasses(previewColor, 'block')} pgem--preview preview`;
        else if (preview.has(`${r},${c}`)) cls += ' preview';
        const cell = el('div', {
          class: cls,
          onclick: () => onCell(r, c),
        });
        gridEl.appendChild(cell);
      }
    }

    tray.innerHTML = '';
    pieces.forEach((p, idx) => {
      const maxR = Math.max(...p.cells.map((x) => x[0]));
      const maxC = Math.max(...p.cells.map((x) => x[1]));
      const pieceEl = el('div', {
        class: 'bb-piece'
          + (p.used ? ' bb-piece--used' : '')
          + (selected === idx ? ' bb-piece--sel' : ''),
        'data-piece-idx': String(idx),
        style: `grid-template-rows:repeat(${maxR + 1},var(--bb-cell-size,14px));grid-template-columns:repeat(${maxC + 1},var(--bb-cell-size,14px))`,
        onclick: (e: Event) => {
          if (document.body.classList.contains('bb-dragging')) return;
          selected = idx;
          bbSfx.pickup();
          paint();
          e.stopPropagation();
        },
      });
      for (const [r, c] of p.cells) {
        const pc = el('div', {
          class: `bb-pcell ${gemClasses(p.color, 'block')}`,
          style: `grid-row:${r + 1};grid-column:${c + 1}`,
        });
        pieceEl.appendChild(pc);
      }
      if (!p.used) tray.appendChild(pieceEl);
    });

    updateHeader();
  }

  function placementFeedback(
    br: number,
    bc: number,
    cells: [number, number][],
    color: string,
    lines: number,
    points: number,
  ): void {
    const placedKeys = cells.map(([dr, dc]) => `${br + dr},${bc + dc}`);
    markPlacedCells(gridEl, placedKeys);
    pulseBoard(gridEl);

    const midR = br + Math.max(...cells.map((x) => x[0])) / 2;
    const midC = bc + Math.max(...cells.map((x) => x[1])) / 2;
    const cellIdx = Math.floor(midR) * SIZE + Math.floor(midC);
    const anchor = gridEl.children[cellIdx] as HTMLElement | undefined;
    const { x, y } = anchor ? centerOf(anchor, wrap) : { x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 };

    const label = labelForPlacement(lines, combo);
    spawnScorePopup(fxLayer, x, y, label, points > 0 ? points : undefined);
    spawnParticles(fxLayer, x, y, color, lines > 0 ? 14 : 8);

    if (lines > 0) {
      spawnSparkles(fxLayer, x, y);
      spawnStreak(fxLayer, x, y);
      shakeWrap(wrap);
      gridEl.classList.add('pboard-clear-flash');
      window.setTimeout(() => gridEl.classList.remove('pboard-clear-flash'), 450);
    }
  }

  function onCell(r: number, c: number): void {
    if (selected == null) { toast('Select a piece first'); return; }
    const p = pieces[selected];
    if (p.used) return;
    if (!canPlace(grid, p.cells, r, c)) {
      bbSfx.invalid();
      gridEl.classList.add('bb-board-pulse');
      window.setTimeout(() => gridEl.classList.remove('bb-board-pulse'), 200);
      toast('Cannot place here');
      return;
    }

    const prevScore = score;
    const placedCells = p.cells;
    const placedColor = p.color;
    place(grid, p.cells, r, c, p.color);
    p.used = true;
    moves++;
    const lines = clearLines(grid);
    let points = 0;
    if (lines > 0) {
      combo += lines;
      highestCombo = Math.max(highestCombo, combo);
      points = lines * 10 + (lines > 1 ? lines * 5 : 0);
      score += points;
      bbSfx.lineClear(lines);
      if (combo >= 2) bbSfx.combo(combo);
    } else {
      bbSfx.place();
    }

    refillTray();
    paint();
    placementFeedback(r, c, placedCells, placedColor, lines, score - prevScore);
    if (!anyFit(grid, pieces)) endRun();
  }

  wireDrag({
    gridEl,
    wrap,
    canPlace: (cells, br, bc) => canPlace(grid, cells, br, bc),
    onPlace: (br, bc) => onCell(br, bc),
    onInvalid: () => {
      bbSfx.invalid();
      toast('Cannot place here');
    },
    onPickup: () => bbSfx.pickup(),
    getSelected: () => selected,
    setSelected: (idx) => { selected = idx; },
    getPiece: (idx) => pieces[idx],
    paint,
  });

  paint();
}

function initBgParticles(): void {
  const layer = document.querySelector('.bb-bg-layer');
  if (!layer) return;
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'bb-bg-particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.bottom = `${Math.random() * 30}%`;
    p.style.animationDelay = `${Math.random() * 8}s`;
    p.style.animationDuration = `${6 + Math.random() * 6}s`;
    layer.appendChild(p);
  }
}

function wireMenu(): void {
  const startBtn = document.getElementById('startBtn');
  document.querySelectorAll('.bb-mode-card:not(.bb-mode-card--locked)').forEach((card) => {
    card.addEventListener('click', () => {
      bbSfx.menu();
      startBtn?.click();
    });
  });
  document.getElementById('bbHomeBtn')?.addEventListener('click', () => {
    bbSfx.click();
    if (history.length > 1) history.back();
    else location.href = '../../';
  });
  document.getElementById('bbLeaderBtn')?.addEventListener('click', () => {
    bbSfx.click();
    location.href = '../../#leaderboard';
  });
}

mountLQ('block-blast', render, {
  headerSlots: [
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
    { id: 'best', labelKey: 'td.best', icon: 'score' },
    { id: 'round', labelKey: 'bb.lines', icon: 'round' },
    { id: 'moves', labelKey: 'shell.moves', icon: 'moves' },
  ],
});

initBgParticles();
wireMenu();
