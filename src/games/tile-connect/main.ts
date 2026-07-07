// Tile Connect — link matching pairs with at most two turns. Native GoPlay brain game.
import '../../styles/base.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, mulberry32, shuffled, sound, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';

const ROWS = 6;
const COLS = 8;
const ICONS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🌸', '⭐', '💎', '🎵', '🦋', '🌙', '🔔'];
const LEVELS = 3;
const host = createHost('tile-connect');

function canConnect(board: (string | null)[][], r1: number, c1: number, r2: number, c2: number): boolean {
  if (board[r1][c1] !== board[r2][c2] || !board[r1][c1]) return false;
  const H = board.length;
  const W = board[0].length;

  type Node = { r: number; c: number; dir: number; turns: number };
  const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  const seen = new Set<string>();
  const q: Node[] = [{ r: r1, c: c1, dir: -1, turns: 0 }];
  seen.add(`${r1},${c1},-1,0`);

  while (q.length) {
    const cur = q.shift()!;
    if (cur.r === r2 && cur.c === c2 && (cur.r !== r1 || cur.c !== c1)) return true;
    for (let d = 0; d < 4; d++) {
      const turns = cur.dir === -1 ? 0 : (d === cur.dir ? cur.turns : cur.turns + 1);
      if (turns > 2) continue;
      let nr = cur.r + dirs[d][0];
      let nc = cur.c + dirs[d][1];
      while (nr >= -1 && nc >= -1 && nr <= H && nc <= W) {
        const inside = nr >= 0 && nc >= 0 && nr < H && nc < W;
        const empty = !inside || !board[nr][nc];
        const isEnd = nr === r2 && nc === c2;
        if (!empty && !isEnd) break;
        const key = `${nr},${nc},${d},${turns}`;
        if (!seen.has(key)) {
          seen.add(key);
          q.push({ r: nr, c: nc, dir: d, turns });
        }
        if (isEnd) return true;
        if (!empty) break;
        nr += dirs[d][0];
        nc += dirs[d][1];
      }
    }
  }
  return false;
}

function buildBoard(pairs: number, rnd: () => number): string[][] {
  const icons = shuffled(ICONS.slice(0, pairs), rnd);
  const deck: string[] = [];
  for (const ic of icons) { deck.push(ic, ic); }
  const cells = shuffled(deck, rnd);
  const board: string[][] = [];
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    board.push([]);
    for (let c = 0; c < COLS; c++) board[r].push(cells[i++] ?? '');
  }
  return board;
}

function remaining(board: (string | null)[][]): number {
  let n = 0;
  for (const row of board) for (const v of row) if (v) n++;
  return n;
}

function render(mount: HTMLElement): void {
  let levelIdx = 0;
  let totalScore = 0;
  const sessionStart = Date.now();

  function loadLevel(): void {
    mount.innerHTML = '';
    const rnd = mulberry32((Math.random() * 1e9) | 0);
    const pairs = 10 + levelIdx * 2;
    const board: (string | null)[][] = buildBoard(pairs, rnd);
    let sel: [number, number] | null = null;
    let moves = 0;
    const levelStart = Date.now();

    const wrap = el('div', { class: 'tc-wrap' });
    const hint = el('p', { class: 'tc-hint', text: 'Tap two matching tiles. Path may bend twice.' });
    const grid = el('div', {
      class: 'tc-board',
      style: `grid-template-columns:repeat(${COLS},1fr)`,
    });
    wrap.appendChild(hint);
    wrap.appendChild(grid);
    mount.appendChild(wrap);

    setLQHeader({ round: `${levelIdx + 1}/${LEVELS}`, score: String(totalScore), moves: '0' });

    function paint(): void {
      grid.innerHTML = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = board[r][c];
          const isSel = sel && sel[0] === r && sel[1] === c;
          grid.appendChild(el('div', {
            class: 'tc-tile' + (!v ? ' tc-empty' : '') + (isSel ? ' tc-tile--sel' : ''),
            text: v ?? '',
            onclick: () => onTap(r, c),
          }));
        }
      }
      setLQHeader({ moves: String(moves) });
    }

    function onTap(r: number, c: number): void {
      if (!board[r][c]) return;
      if (!sel) {
        sel = [r, c];
        sound('click');
        paint();
        return;
      }
      const [r1, c1] = sel;
      if (r1 === r && c1 === c) { sel = null; paint(); return; }
      if (board[r1][c1] !== board[r][c] || !canConnect(board, r1, c1, r, c)) {
        sound('bad');
        toast('No valid path');
        sel = [r, c];
        paint();
        return;
      }
      board[r1][c1] = null;
      board[r][c] = null;
      moves++;
      sel = null;
      sound('good');
      paint();
      if (remaining(board) === 0) finishLevel();
    }

    function finishLevel(): void {
      sound('win');
      const elapsedMs = Date.now() - levelStart;
      const levelScore = puzzleCompletionScore(elapsedMs, 0, { budgetSec: 300, base: 80 })
        + Math.max(0, pairs * 2 - moves) * 8;
      totalScore += levelScore;
      levelIdx++;
      setLQHeader({ round: `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`, score: String(totalScore) });
      if (levelIdx >= LEVELS) {
        finishLQRound(totalScore, totalScore >= host.winScore, `${LEVELS}/${LEVELS} boards`, Date.now() - sessionStart);
      } else {
        setTimeout(loadLevel, 600);
      }
    }

    paint();
  }

  loadLevel();
}

mountLQ('tile-connect', render, {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
