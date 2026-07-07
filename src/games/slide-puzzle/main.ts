// Slide Puzzle — classic 15-puzzle. Native GoPlay brain game.
import '../../styles/base.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, mulberry32, shuffled, sound, mountLQ, setLQHeader } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';

const SIZE = 4;
const LEVELS = 3;
const host = createHost('slide-puzzle');

function solved(): number[] {
  const arr: number[] = [];
  for (let i = 1; i < SIZE * SIZE; i++) arr.push(i);
  arr.push(0);
  return arr;
}

function inversionCount(arr: number[]): number {
  let inv = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === 0) continue;
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[j] !== 0 && arr[i] > arr[j]) inv++;
    }
  }
  return inv;
}

function isSolvable(arr: number[]): boolean {
  const inv = inversionCount(arr);
  const blankRow = Math.floor(arr.indexOf(0) / SIZE);
  return (inv + blankRow) % 2 === 1;
}

function scramble(seed: number, scrambleMoves: number): number[] {
  const rnd = mulberry32(seed);
  let tiles: number[];
  do { tiles = shuffled(solved(), rnd); } while (!isSolvable(tiles));
  for (let m = 0; m < scrambleMoves; m++) {
    const empty = tiles.indexOf(0);
    const er = Math.floor(empty / SIZE);
    const ec = empty % SIZE;
    const opts = [empty - 1, empty + 1, empty - SIZE, empty + SIZE].filter((i) => {
      if (i < 0 || i >= SIZE * SIZE) return false;
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      return Math.abs(er - r) + Math.abs(ec - c) === 1;
    });
    const pick = opts[Math.floor(rnd() * opts.length)];
    [tiles[empty], tiles[pick]] = [tiles[pick], tiles[empty]];
  }
  return tiles;
}

function render(mountEl: HTMLElement): void {
  let levelIdx = 0;
  let totalScore = 0;
  let sessionStart = Date.now();
  let tiles: number[] = [];
  let moves = 0;
  let locked = false;
  let levelStart = 0;

  function loadLevel(): void {
    tiles = scramble(levelIdx * 997 + 3, 12 + levelIdx * 18);
    moves = 0;
    locked = false;
    levelStart = Date.now();
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
    if (tiles.every((v, idx) => v === solved()[idx])) finishLevel();
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
