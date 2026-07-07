// Laser Puzzle — rotate mirrors to hit all targets. Native GoPlay brain game.
import '../../styles/base.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, sound, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { lqHelp } from '../_lq/help';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';
import { showFirstRunHint } from '../_shared/firstRun';

const LEVELS = 5;
const host = createHost('laser-puzzle');

/** 0=empty 1=wall 2=source 3=target 4=mirror / 5=mirror \ */
type Cell = 0 | 1 | 2 | 3 | 4 | 5;
type Dir = 0 | 1 | 2 | 3; // up right down left

const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

interface LevelDef {
  w: number;
  h: number;
  srcR: number;
  srcC: number;
  srcDir: Dir;
  grid: Cell[][];
  par: number;
}

const LEVELS_DEF: LevelDef[] = [
  {
    w: 6, h: 6, srcR: 3, srcC: 0, srcDir: 1, par: 1,
    grid: [
      [1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 3, 1],
      [1, 0, 0, 0, 0, 1],
      [2, 0, 0, 0, 5, 1],
      [1, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1],
    ],
  },
  {
    w: 7, h: 7, srcR: 3, srcC: 0, srcDir: 1, par: 4,
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 3, 0, 0, 1],
      [1, 0, 4, 0, 0, 0, 1],
      [2, 0, 0, 5, 0, 0, 1],
      [1, 0, 0, 0, 4, 0, 1],
      [1, 0, 0, 0, 0, 3, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    w: 8, h: 8, srcR: 4, srcC: 0, srcDir: 1, par: 6,
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 3, 0, 0, 1],
      [1, 0, 4, 0, 0, 0, 0, 1],
      [1, 0, 0, 5, 0, 4, 0, 1],
      [2, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 4, 5, 0, 3, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    w: 7, h: 7, srcR: 3, srcC: 0, srcDir: 1, par: 5,
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 3, 0, 0, 0, 1],
      [1, 0, 4, 5, 0, 0, 1],
      [2, 0, 0, 4, 0, 3, 1],
      [1, 0, 0, 5, 4, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    w: 8, h: 8, srcR: 4, srcC: 0, srcDir: 1, par: 7,
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 3, 0, 0, 0, 1],
      [1, 0, 4, 5, 4, 0, 0, 1],
      [1, 0, 5, 0, 5, 0, 0, 1],
      [2, 0, 0, 4, 0, 0, 3, 1],
      [1, 0, 0, 5, 4, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
];

function reflectSlash(dir: Dir): Dir {
  return (dir === 0 ? 1 : dir === 1 ? 0 : dir === 2 ? 3 : 2) as Dir;
}

function reflectBackslash(dir: Dir): Dir {
  return (dir === 0 ? 3 : dir === 1 ? 2 : dir === 2 ? 1 : 0) as Dir;
}

function trace(def: LevelDef, grid: Cell[][]): { lit: Set<string>; segments: Array<[number, number, number, number]> } {
  const lit = new Set<string>();
  const segments: Array<[number, number, number, number]> = [];
  let r = def.srcR;
  let c = def.srcC;
  let dir: Dir = def.srcDir;
  const cellSize = 42;
  const gap = 3;
  const pad = 8;
  const step = cellSize + gap;

  for (let guard = 0; guard < 80; guard++) {
    const nr = r + DR[dir];
    const nc = c + DC[dir];
    if (nr < 0 || nc < 0 || nr >= def.h || nc >= def.w) break;
    const x1 = pad + c * step + cellSize / 2;
    const y1 = pad + r * step + cellSize / 2;
    const x2 = pad + nc * step + cellSize / 2;
    const y2 = pad + nr * step + cellSize / 2;
    segments.push([x1, y1, x2, y2]);
    r = nr;
    c = nc;
    const cell = grid[r][c];
    if (cell === 1) break;
    if (cell === 3) lit.add(`${r},${c}`);
    if (cell === 4) dir = reflectSlash(dir);
    else if (cell === 5) dir = reflectBackslash(dir);
    else if (cell === 2) { /* pass through source cell */ }
  }
  return { lit, segments };
}

function targetCount(grid: Cell[][]): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c === 3) n++;
  return n;
}

function cellLabel(cell: Cell): string {
  if (cell === 2) return '▶';
  if (cell === 3) return '◎';
  if (cell === 4) return '/';
  if (cell === 5) return '\\';
  return '';
}

function render(mount: HTMLElement): void {
  let levelIdx = 0;
  let totalScore = 0;
  let rotations = 0;
  const sessionStart = Date.now();

  function loadLevel(): void {
    mount.innerHTML = '';
    const def = LEVELS_DEF[levelIdx];
    const grid = def.grid.map((row) => row.slice()) as Cell[][];
    rotations = 0;
    let locked = false;
    const levelStart = Date.now();
    const targets = targetCount(grid);

    const wrap = el('div', { class: 'lp-wrap' });
    const hint = el('p', { class: 'lp-hint', text: lqHelp('laser-puzzle') });
    const status = el('p', { class: 'lp-status', text: `0/${targets} targets` });
    const boardWrap = el('div', { style: 'position:relative' });
    const board = el('div', {
      class: 'lp-board',
      style: `grid-template-columns:repeat(${def.w},1fr)`,
    });
    boardWrap.appendChild(board);
    wrap.appendChild(hint);
    wrap.appendChild(status);
    wrap.appendChild(boardWrap);
    mount.appendChild(wrap);

    if (levelIdx === 0) {
      showFirstRunHint('laser-puzzle', toast);
    }

    setLQHeader({ round: `${levelIdx + 1}/${LEVELS}`, score: String(totalScore), moves: '0' });

    function paint(): void {
      const { lit, segments } = trace(def, grid);
      board.innerHTML = '';
      boardWrap.querySelectorAll('.lp-beam').forEach((n) => n.remove());

      const cbGlyphs = ['○', '□', '△', '◇'];
      let tgtIdx = 0;

      for (let r = 0; r < def.h; r++) {
        for (let c = 0; c < def.w; c++) {
          const cell = grid[r][c];
          let cls = 'lp-cell';
          if (cell === 1) cls += ' lp-cell--wall';
          else if (cell === 2) cls += ' lp-cell--src';
          else if (cell === 3) cls += ' lp-cell--tgt' + (lit.has(`${r},${c}`) ? ' lp-lit' : '');
          else if (cell === 4 || cell === 5) cls += ' lp-cell--mirror';

          const attrs: Record<string, string> = { class: cls, text: cellLabel(cell) };
          if (cell === 3) attrs['data-cb'] = cbGlyphs[tgtIdx++ % cbGlyphs.length];

          const node = el('div', attrs);
          if (cell === 4 || cell === 5) {
            node.addEventListener('click', () => {
              grid[r][c] = cell === 4 ? 5 : 4;
              rotations++;
              sound('click');
              paint();
            });
          }
          board.appendChild(node);
        }
      }

      for (const [x1, y1, x2, y2] of segments) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const beam = el('div', {
          class: 'lp-beam' + (lit.size === targets ? ' lp-beam--win' : ''),
          style: `left:${x1}px;top:${y1}px;width:${len}px;height:3px;transform:rotate(${angle}deg);transform-origin:0 50%`,
        });
        boardWrap.appendChild(beam);
      }

      const { lit: litNow } = trace(def, grid);
      status.textContent = `${litNow.size}/${targets} targets`;
      setLQHeader({ moves: String(rotations) });
      if (!locked && litNow.size === targets) finishLevel();
    }

    function finishLevel(): void {
      if (locked) return;
      locked = true;
      sound('win');
      const elapsedMs = Date.now() - levelStart;
      const moveBonus = Math.max(0, def.par - rotations) * 20;
      totalScore += puzzleCompletionScore(elapsedMs, 0, { budgetSec: 360, base: 100 }) + moveBonus;
      levelIdx++;
      setLQHeader({ round: `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`, score: String(totalScore) });
      if (levelIdx >= LEVELS) {
        finishLQRound(totalScore, totalScore >= host.winScore, `${LEVELS}/${LEVELS} puzzles`, Date.now() - sessionStart);
      } else {
        setTimeout(loadLevel, 700);
      }
    }

    paint();
  }

  loadLevel();
}

mountLQ('laser-puzzle', render, {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'lp.rotations', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
