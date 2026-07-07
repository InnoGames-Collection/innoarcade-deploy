// Tile Connect — link matching pairs with at most two turns. Native GoPlay brain game.
import '../../styles/base.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, mulberry32, sound, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';
import { tileConnectCanConnect, tileConnectFindHint } from '../_lq/solvable';
import { buildSolvableTileBoard } from '../_lq/levelGen';
import { showFirstRunHint } from '../_shared/firstRun';

const ROWS = 6;
const COLS = 8;
const ICONS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🌸', '⭐', '💎', '🎵', '🦋', '🌙', '🔔'];
const LEVELS = 5;
const host = createHost('tile-connect');

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
    const pairs = 8 + levelIdx * 2;
    const board: (string | null)[][] = buildSolvableTileBoard(ROWS, COLS, ICONS, pairs, rnd);
    let sel: [number, number] | null = null;
    let hintPair: [number, number, number, number] | null = null;
    let moves = 0;
    const levelStart = Date.now();

    const wrap = el('div', { class: 'tc-wrap' });
    const hint = el('p', { class: 'tc-hint', text: 'Tap two matching tiles. Path may bend twice.' });
    const toolbar = el('div', { class: 'tc-toolbar' });
    const hintBtn = el('button', {
      type: 'button',
      class: 'btn tc-hint-btn',
      text: '💡 Hint',
      onclick: () => showHint(),
    });
    toolbar.appendChild(hintBtn);
    const grid = el('div', {
      class: 'tc-board',
      style: `grid-template-columns:repeat(${COLS},1fr)`,
    });
    wrap.appendChild(hint);
    wrap.appendChild(toolbar);
    wrap.appendChild(grid);
    mount.appendChild(wrap);

    if (levelIdx === 0) {
      showFirstRunHint('tile-connect', toast);
    }

    setLQHeader({ round: `${levelIdx + 1}/${LEVELS}`, score: String(totalScore), moves: '0' });

    function showHint(): void {
      hintPair = tileConnectFindHint(board);
      if (!hintPair) {
        toast('No moves left');
        return;
      }
      sound('click');
      paint();
      toast('Highlighted pair can connect');
    }

    function paint(): void {
      grid.innerHTML = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = board[r][c];
          const isSel = sel && sel[0] === r && sel[1] === c;
          const isHint = hintPair
            && ((hintPair[0] === r && hintPair[1] === c) || (hintPair[2] === r && hintPair[3] === c));
          grid.appendChild(el('div', {
            class: 'tc-tile'
              + (!v ? ' tc-empty' : '')
              + (isSel ? ' tc-tile--sel' : '')
              + (isHint ? ' tc-tile--hint' : ''),
            text: v ?? '',
            onclick: () => onTap(r, c),
          }));
        }
      }
      setLQHeader({ moves: String(moves) });
    }

    function onTap(r: number, c: number): void {
      if (!board[r][c]) return;
      hintPair = null;
      if (!sel) {
        sel = [r, c];
        sound('click');
        paint();
        return;
      }
      const [r1, c1] = sel;
      if (r1 === r && c1 === c) { sel = null; paint(); return; }
      if (board[r1][c1] !== board[r][c] || !tileConnectCanConnect(board, r1, c1, r, c)) {
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
