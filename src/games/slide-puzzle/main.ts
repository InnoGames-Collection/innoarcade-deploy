// Slide Puzzle — classic 15-puzzle. Native GoPlay brain game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, mulberry32, sound, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';
import { slidePuzzleScramble, slidePuzzleSolved } from '../_lq/solvable';
import { showFirstRunHint } from '../_shared/firstRun';

const SIZE = 4;
const LEVELS = 5;
const host = createHost('slide-puzzle');

function render(mountEl: HTMLElement): void {
  let levelIdx = 0;
  let totalScore = 0;
  let sessionStart = Date.now();
  let tiles: number[] = [];
  let moves = 0;
  let locked = false;
  let levelStart = 0;
  const solved = slidePuzzleSolved(SIZE);

  function loadLevel(): void {
    tiles = slidePuzzleScramble(SIZE, 14 + levelIdx * 16, mulberry32(levelIdx * 997 + 3));
    moves = 0;
    locked = false;
    levelStart = Date.now();
    if (levelIdx === 0) {
      showFirstRunHint('slide-puzzle', toast);
    }
    setLQHeader({
      round: `${levelIdx + 1}/${LEVELS}`,
      moves: String(moves),
      score: String(totalScore),
    });
    paint();
  }

  function tryMove(i: number): void {
    if (locked) return;
    const empty = tiles.indexOf(0);
    const er = Math.floor(empty / SIZE);
    const ec = empty % SIZE;
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    if (Math.abs(er - r) + Math.abs(ec - c) !== 1) return;
    [tiles[empty], tiles[i]] = [tiles[i], tiles[empty]];
    moves++;
    sound('click');
    setLQHeader({ moves: String(moves) });
    paint();
    if (tiles.every((v, idx) => v === solved[idx])) finishLevel();
  }

  function paint(): void {
    mountEl.innerHTML = '';
    const wrap = el('div', { class: 'sp-grid' });
    tiles.forEach((v, i) => {
      wrap.appendChild(el('button', {
        type: 'button',
        class: 'sp-tile' + (v === 0 ? ' empty' : ''),
        ...(v === 0 ? { disabled: '' } : {}),
        onclick: () => tryMove(i),
      }, v === 0 ? '' : String(v)));
    });
    mountEl.appendChild(wrap);
  }

  function finishLevel(): void {
    if (locked) return;
    locked = true;
    sound('win');
    const par = 10 + (levelIdx + 1) * 15;
    const elapsedMs = Date.now() - levelStart;
    const moveBonus = Math.max(0, par - moves) * 8;
    totalScore += puzzleCompletionScore(elapsedMs, 0, { budgetSec: 420, base: 80 }) + moveBonus;
    levelIdx++;
    setLQHeader({
      round: `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`,
      score: String(totalScore),
    });
    if (levelIdx >= LEVELS) {
      finishLQRound(totalScore, totalScore >= host.winScore, `${LEVELS}/${LEVELS} puzzles`, Date.now() - sessionStart);
    } else {
      window.setTimeout(loadLevel, 700);
    }
  }

  sessionStart = Date.now();
  loadLevel();
}

mountLQ('slide-puzzle', render, {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
