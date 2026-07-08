// Pipe Connect — rotate pipes to link source to drain. Native GoPlay brain game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, sound, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';
import { pipeGridConnected, type PipeCell, type PipeRot } from '../_lq/solvable';
import { showFirstRunHint } from '../_shared/firstRun';

const LEVELS = 5;
const host = createHost('pipe-connect');

interface LevelDef {
  w: number;
  h: number;
  grid: PipeCell[][];
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
  {
    w: 7, h: 7, par: 10,
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 2, 5, 0, 4, 0, 1],
      [1, 0, 4, 5, 4, 0, 1],
      [1, 0, 5, 4, 5, 0, 1],
      [1, 0, 4, 5, 4, 0, 1],
      [1, 0, 0, 4, 4, 3, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    w: 8, h: 8, par: 12,
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 4, 5, 4, 5, 0, 1],
      [1, 0, 5, 4, 5, 4, 0, 1],
      [1, 0, 4, 5, 4, 5, 0, 1],
      [1, 0, 5, 4, 5, 4, 0, 1],
      [1, 0, 4, 5, 4, 5, 0, 1],
      [1, 0, 0, 0, 4, 4, 3, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
];

function pipeChar(cell: PipeCell, rot: PipeRot): string {
  if (cell === 2) return '💧';
  if (cell === 3) return '🕳';
  if (cell === 4) return rot % 2 === 0 ? '═' : '║';
  if (cell === 5) {
    const chars = ['╚', '╝', '╗', '╔'];
    return chars[rot % 4];
  }
  return '';
}

function render(mountEl: HTMLElement): void {
  let levelIdx = 0;
  let totalScore = 0;
  let sessionStart = Date.now();
  let grid: PipeCell[][] = [];
  let rots: PipeRot[][] = [];
  let rotations = 0;
  let locked = false;
  let levelStart = 0;
  let waterFill = false;

  function loadLevel(): void {
    const def = LEVELS_DEF[levelIdx];
    grid = def.grid.map((row) => row.slice());
    rots = grid.map((row) => row.map(() => 0 as PipeRot));
    rotations = 0;
    locked = false;
    waterFill = false;
    levelStart = Date.now();
    if (levelIdx === 0) {
      showFirstRunHint('pipe-connect', toast);
    }
    setLQHeader({
      round: `${levelIdx + 1}/${LEVELS}`,
      moves: String(rotations),
      score: String(totalScore),
    });
    paint();
  }

  function paint(): void {
    mountEl.innerHTML = '';
    const wrap = el('div', {
      class: 'pc-grid' + (waterFill ? ' pc-solved' : ''),
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
            rots[rr][cc] = ((rots[rr][cc] + 1) % 4) as PipeRot;
            rotations++;
            sound('click');
            setLQHeader({ moves: String(rotations) });
            if (pipeGridConnected(grid, rots)) {
              waterFill = true;
              sound('win');
              paint();
              window.setTimeout(finishLevel, 750);
              return;
            }
            paint();
          },
        }, pipeChar(cell, rots[r][c]));
        wrap.appendChild(btn);
      }
    }
    mountEl.appendChild(wrap);
  }

  function finishLevel(): void {
    if (locked) return;
    locked = true;
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
