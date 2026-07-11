// Hexa Block — place hex clusters on a honeycomb board; clear full rows.
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
import { sfx } from '../../engine/audio';
import { hbSfx } from './sounds';
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

function piecePreviewEl(
  p: Piece,
  idx: number,
  selected: number | null,
  onSelect: () => void,
): HTMLElement {
  let maxR = 0;
  let maxC = 0;
  for (const [dr, dc] of p.cells) {
    maxR = Math.max(maxR, dr);
    maxC = Math.max(maxC, dc);
  }
  const pieceEl = el('div', {
    class: 'hb-piece'
      + (p.used ? ' hb-piece--used' : '')
      + (selected === idx ? ' hb-piece--sel' : ''),
    'data-piece-idx': String(idx),
    onclick: (e: Event) => {
      if (document.body.classList.contains('hb-dragging')) return;
      onSelect();
      e.stopPropagation();
    },
  });
  for (let r = 0; r <= maxR; r++) {
    const mini = el('div', { class: 'hb-row hb-row--mini' });
    for (let c = 0; c <= maxC; c++) {
      const filled = p.cells.some(([dr, dc]) => dr === r && dc === c);
      mini.appendChild(el('div', {
        class: filled ? `hb-cell filled ${gemClasses(p.color, 'hex')}` : 'hb-cell hb-cell--ghost',
        style: filled ? '' : 'opacity:0',
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
  const grid: (string | null)[][] = [];
  for (let r = 0; r < ROWS; r++) grid[r] = Array(rowWidth(r)).fill(null);

  let pieces = [randomPiece(rnd), randomPiece(rnd), randomPiece(rnd)];
  let score = 0;
  let lines = 0;
  let combo = 0;
  let highestCombo = 0;
  let selected: number | null = null;
  let sessionBest = readMenuBest();
  const t0 = Date.now();

  const wrap = el('div', { class: 'hb-wrap' });
  const fxLayer = el('div', { class: 'hb-fx-layer' });
  const hint = el('p', { class: 'hb-hint', text: 'Drag a hex piece onto the board, or tap to select then place.' });
  const boardEl = el('div', { class: 'hb-board pboard' });
  const tray = el('div', { class: 'hb-tray' });
  wrap.appendChild(hint);
  wrap.appendChild(boardEl);
  wrap.appendChild(tray);
  wrap.appendChild(fxLayer);
  mount.appendChild(wrap);

  showFirstRunHint('hexa-block', toast);

  function updateHeader(): void {
    setLQHeader({
      score: String(score),
      best: String(sessionBest),
      combo: combo > 0 ? `×${combo}` : '—',
      round: String(lines),
    });
    animateHudValue(hudEl('score'), String(score));
    animateHudValue(hudEl('combo'), combo > 0 ? `×${combo}` : '—');
    animateHudValue(hudEl('round'), String(lines));
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
    for (let r = 0; r < ROWS; r++) {
      const w = rowWidth(r);
      for (let c = 0; c < w; c++) {
        if (!canPlace(grid, p.cells, r, c)) continue;
        for (const [dr, dc] of p.cells) set.add(`${r + dr},${c + dc}`);
      }
    }
    return set;
  }

  function paintRunStatsOnOver(): void {
    const linesEl = document.getElementById('hbOverLines');
    const comboEl = document.getElementById('hbOverCombo');
    const resultEl = document.getElementById('hbOverResult');
    if (linesEl) linesEl.textContent = String(lines);
    if (comboEl) comboEl.textContent = `×${highestCombo}`;
    if (resultEl) {
      resultEl.textContent = score >= host.winScore ? 'Victory' : 'Good try';
    }
    const finalEl = document.getElementById('finalScore');
    if (finalEl) animateCountUp(finalEl, score);
    const overPanel = document.querySelector('#overOverlay .game-panel');
    if (score >= host.winScore && overPanel) launchConfetti(overPanel as HTMLElement);
  }

  function endRun(): void {
    paintRunStatsOnOver();
    if (score >= host.winScore) hbSfx.victory();
    else hbSfx.gameOver();
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
        const fill = grid[r][c];
        const previewColor = preview.has(key) && selected != null && !fill
          ? pieces[selected].color
          : null;
        let cls = 'hb-cell';
        if (fill) cls += ` filled ${gemClasses(fill, 'hex')}`;
        else cls += ' pboard-slot';
        if (previewColor) cls += ` ${gemClasses(previewColor, 'hex')} pgem--preview hb-preview`;
        else if (preview.has(key)) cls += ' hb-preview';
        row.appendChild(el('div', {
          class: cls,
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
        hbSfx.pickup();
        paint();
      }));
    });

    updateHeader();
  }

  function placementFeedback(
    br: number,
    bc: number,
    cells: [number, number][],
    color: string,
    cleared: number,
    points: number,
  ): void {
    const placedKeys = cells.map(([dr, dc]) => `${br + dr},${bc + dc}`);
    markPlacedCells(boardEl, placedKeys);
    pulseBoard(boardEl);

    const midR = br + Math.max(...cells.map((x) => x[0])) / 2;
    const midC = bc + Math.max(...cells.map((x) => x[1])) / 2;
    const rowEl = boardEl.children[Math.floor(midR)] as HTMLElement | undefined;
    const anchor = rowEl?.children[Math.floor(midC)] as HTMLElement | undefined;
    const { x, y } = anchor
      ? centerOf(anchor, wrap)
      : { x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 };

    const label = labelForPlacement(cleared, combo);
    spawnScorePopup(fxLayer, x, y, label, points > 0 ? points : undefined);
    spawnParticles(fxLayer, x, y, color, cleared > 0 ? 14 : 8);

    if (cleared > 0) {
      spawnSparkles(fxLayer, x, y);
      spawnStreak(fxLayer, x, y);
      shakeWrap(wrap);
      boardEl.classList.add('pboard-clear-flash');
      window.setTimeout(() => boardEl.classList.remove('pboard-clear-flash'), 450);
    }
  }

  function onCell(r: number, c: number): void {
    if (selected == null) { toast('Select a piece first'); return; }
    const p = pieces[selected];
    if (p.used || !canPlace(grid, p.cells, r, c)) {
      hbSfx.invalid();
      shakeWrap(wrap);
      toast('Cannot place here');
      return;
    }

    const prevScore = score;
    const placedCells = p.cells;
    const placedColor = p.color;
    place(grid, p.cells, r, c, p.color);
    p.used = true;
    const cleared = clearRows(grid);
    let points = 0;
    if (cleared) {
      combo += cleared;
      highestCombo = Math.max(highestCombo, combo);
      lines += cleared;
      points = cleared * 15;
      score += points;
      hbSfx.lineClear(cleared);
      if (combo >= 2) hbSfx.combo(combo);
    } else {
      combo = 0;
      hbSfx.place();
    }

    if (pieces.every((x) => x.used)) {
      pieces = [randomPiece(rnd), randomPiece(rnd), randomPiece(rnd)];
    }
    selected = null;
    paint();
    placementFeedback(r, c, placedCells, placedColor, cleared, score - prevScore);
    if (!anyFit(grid, pieces)) endRun();
  }

  wireDrag({
    gridEl: boardEl,
    wrap,
    rowWidth,
    canPlace: (cells, br, bc) => canPlace(grid, cells, br, bc),
    onPlace: (br, bc) => onCell(br, bc),
    onInvalid: () => {
      hbSfx.invalid();
      shakeWrap(wrap);
      toast('Cannot place here');
    },
    onPickup: () => hbSfx.pickup(),
    getSelected: () => selected,
    setSelected: (idx) => { selected = idx; },
    getPiece: (idx) => pieces[idx],
    paint,
  });

  paint();
}

function initBgParticles(): void {
  const layer = document.querySelector('.hb-bg-layer');
  if (!layer) return;
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'hb-bg-particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.bottom = `${Math.random() * 30}%`;
    p.style.animationDelay = `${Math.random() * 8}s`;
    p.style.animationDuration = `${6 + Math.random() * 6}s`;
    layer.appendChild(p);
  }
}

function wireMenu(): void {
  const startBtn = document.getElementById('startBtn');
  document.querySelectorAll('.hb-mode-card:not(.hb-mode-card--locked)').forEach((card) => {
    card.addEventListener('click', () => {
      hbSfx.menu();
      startBtn?.click();
    });
  });
  document.getElementById('hbHomeBtn')?.addEventListener('click', () => {
    hbSfx.click();
    if (history.length > 1) history.back();
    else location.href = '../../';
  });
  document.getElementById('hbLeaderBtn')?.addEventListener('click', () => {
    hbSfx.click();
    location.href = '../../#leaderboard';
  });
}

function wireSettings(): void {
  const btn = document.getElementById('hbSettingsBtn');
  if (!btn) return;
  const sync = (): void => {
    btn.textContent = sfx.muted ? '🔇' : '🔊';
    btn.classList.toggle('hb-settings-btn--muted', sfx.muted);
  };
  sync();
  btn.addEventListener('click', () => {
    sfx.toggleMute();
    sync();
    if (!sfx.muted) hbSfx.click();
  });
}

mountLQ('hexa-block', render, {
  pauseable: true,
  headerSlots: [
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
    { id: 'best', labelKey: 'td.best', icon: 'score' },
    { id: 'combo', label: 'Combo', icon: 'round' },
    { id: 'round', labelKey: 'hb.rows', icon: 'round' },
  ],
});

initBgParticles();
wireMenu();
wireSettings();
