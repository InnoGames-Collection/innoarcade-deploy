// Pipe Connect — rotate pipes to link source to drain. Native GoPlay brain game.
import '../../styles/base.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, sound, mountLQ, setLQHeader } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';

const LEVELS = 3;
const host = createHost('pipe-connect');

/** 0=empty 1=wall 2=source 3=drain 4=straight 5=corner */
type Cell = 0 | 1 | 2 | 3 | 4 | 5;
type Rot = 0 | 1 | 2 | 3;

interface LevelDef {
  w: number;
  h: number;
  grid: Cell[][];
  par: number;
}

const LEVELS_DEF: LevelDef[] = [
  {
    w: 6, h: 6, par: 2,
    grid: [
      [1, 1, 1, 1, 1, 1],
      [1, 2, 4, 4, 4, 1],
      [1, 0, 0, 0, 5, 1],
      [1, 0, 0, 0, 4, 1],
      [1, 0, 0, 0, 3, 1],
      [1, 1, 1, 1, 1, 1],
    ],
  },
  {
    w: 7, h: 7, par: 5,
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 2, 4, 0, 5, 4, 1],
      [1, 0, 5, 0, 4, 0, 1],
      [1, 0, 4, 5, 4, 0, 1],
      [1, 0, 5, 0, 5, 0, 1],
      [1, 0, 4, 4, 4, 3, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    w: 8, h: 8, par: 8,
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 4, 5, 0, 5, 4, 1],
      [1, 0, 5, 4, 5, 4, 0, 1],
      [1, 0, 4, 5, 4, 5, 0, 1],
      [1, 0, 5, 4, 5, 4, 0, 1],
      [1, 0, 4, 5, 4, 5, 0, 1],
      [1, 0, 0, 4, 4, 4, 3, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
];

const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

function ports(cell: Cell, rot: Rot): boolean[] {
  const open = [false, false, false, false];
  if (cell === 4) {
    if (rot % 2 === 0) { open[1] = open[3] = true; }
    else { open[0] = open[2] = true; }
  } else if (cell === 5) {
    const r = rot % 4;
    if (r === 0) { open[1] = open[2] = true; }
    if (r === 1) { open[2] = open[3] = true; }
    if (r === 2) { open[0] = open[3] = true; }
    if (r === 3) { open[0] = open[1] = true; }
  } else if (cell === 2) {
    open[1] = true;
  } else if (cell === 3) {
    open[3] = true;
  }
  return open;
}

function pipeChar(cell: Cell, rot: Rot): string {
  if (cell === 2) return '💧';
  if (cell === 3) return '🕳';
  if (cell === 4) return rot % 2 === 0 ? '═' : '║';
  if (cell === 5) {
    const chars = ['╚', '╝', '╗', '╔'];
    return chars[rot % 4];
  }
  return '';
}

function connected(grid: Cell[][], rots: Rot[][]): boolean {
  let srcR = -1; let srcC = -1;
  let drainR = -1; let drainC = -1;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] === 2) { srcR = r; srcC = c; }
      if (grid[r][c] === 3) { drainR = r; drainC = c; }
    }
  }
  if (srcR < 0 || drainR < 0) return false;

  const seen = new Set<string>();
  const q: [number, number][] = [[srcR, srcC]];
  seen.add(`${srcR},${srcC}`);

  while (q.length) {
    const [r, c] = q.shift()!;
    if (r === drainR && c === drainC) return true;
    const p = ports(grid[r][c], rots[r][c]);
    for (let d = 0; d < 4; d++) {
      if (!p[d]) continue;
      const nr = r + DR[d];
      const nc = c + DC[d];
      if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) continue;
      const ncell = grid[nr][nc];
      if (ncell === 0 || ncell === 1) continue;
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      const np = ports(ncell, rots[nr][nc]);
      if (np[(d + 2) % 4]) {
        seen.add(key);
        q.push([nr, nc]);
      }
    }
  }
  return false;
}

function render(_mount: HTMLElement): void {
  let levelIdx = 0;
  let totalScore = 0;
  let sessionStart = Date.now();
  let grid: Cell[][] = [];
  let rots: Rot[][] = [];
  let rotations = 0;
  let locked = false;
  let levelStart = 0;

  function loadLevel(): void {
    const def = LEVELS_DEF[levelIdx];
    grid = def.grid.map((row) => row.slice());
    rots = grid.map((row) => row.map(() => 0 as Rot));
    rotations = 0;
    locked = false;
    levelStart = Date.now();
    setLQHeader({
      round: `${levelIdx + 1}/${LEVELS}`,
      moves: String(rotations),
      score: String(totalScore),
    });
    paint();
  }

  function paint(): void {
    const mount = document.getElementById('lq-mount')!;
    mount.innerHTML = '';
    const wrap = el('div', {
      class: 'pc-grid',
      style: `grid-template-columns:repeat(${grid[0].length},1fr)`,
    });
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        const cell = grid[r][c];
        const rr = r;
        const cc = c;
        const btn = el('button', {
          type: 'button',
          class: `pc-cell c${cell}`,
          onclick: () => {
            if (locked || cell < 4) return;
            rots[rr][cc] = ((rots[rr][cc] + 1) % 4) as Rot;
            rotations++;
            sound('click');
            setLQHeader({ moves: String(rotations) });
            paint();
            if (connected(grid, rots)) finishLevel();
          },
        }, pipeChar(cell, rots[r][c]));
        wrap.appendChild(btn);
      }
    }
    mount.appendChild(wrap);
  }

  function finishLevel(): void {
    if (locked) return;
    locked = true;
    sound('win');
    const def = LEVELS_DEF[levelIdx];
    const elapsedMs = Date.now() - levelStart;
    const moveBonus = Math.max(0, def.par - rotations) * 15;
    totalScore += puzzleCompletionScore(elapsedMs, 0, { budgetSec: 300, base: 90 }) + moveBonus;
    levelIdx++;
    setLQHeader({
      round: `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`,
      score: String(totalScore),
    });
    if (levelIdx >= LEVELS) {
      finishLQRound(totalScore, totalScore >= host.winScore, `${LEVELS}/${LEVELS} levels`, Date.now() - sessionStart);
    } else {
      window.setTimeout(loadLevel, 700);
    }
  }

  sessionStart = Date.now();
  loadLevel();
}

mountLQ('pipe-connect', render, {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'lp.rotations', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
