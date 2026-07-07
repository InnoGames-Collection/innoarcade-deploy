// Water Sort — pour colored liquids into tubes until each holds one color. Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, mulberry32, shuffled, sound, mountLQ, setLQHeader, toast, emitLQLevelComplete } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { escalateTier } from '../../platform/freeDifficulty';
import { createHost } from '../../platform/gameHost';
import { showFirstRunHint } from '../_shared/firstRun';

const CAPACITY = 4;
const LEVELS = 8;
const EMPTY_TUBES = 2;

/** Distinct liquid colors (id 1..N maps to index 0..N-1). */
const LIQUID = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#6c5ce7'];

type Tube = number[];
type Tubes = Tube[];

const host = createHost('water-sort');

function cloneTubes(tubes: Tubes): Tubes {
  return tubes.map((t) => t.slice());
}

function topRunLength(tube: Tube): number {
  if (tube.length === 0) return 0;
  const c = tube[tube.length - 1];
  let n = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === c; i--) n++;
  return n;
}

function canPour(from: Tube, to: Tube): boolean {
  if (from.length === 0 || from === to) return false;
  if (to.length >= CAPACITY) return false;
  if (to.length === 0) return true;
  return to[to.length - 1] === from[from.length - 1];
}

function pour(from: Tube, to: Tube): boolean {
  if (!canPour(from, to)) return false;
  const amount = Math.min(topRunLength(from), CAPACITY - to.length);
  for (let i = 0; i < amount; i++) to.push(from.pop()!);
  return true;
}

function isSolved(tubes: Tubes): boolean {
  for (const t of tubes) {
    if (t.length === 0) continue;
    if (t.length !== CAPACITY) return false;
    const c = t[0];
    if (!t.every((x) => x === c)) return false;
  }
  return true;
}

function solvedState(numColors: number): Tubes {
  const tubes: Tubes = [];
  for (let c = 1; c <= numColors; c++) tubes.push(Array(CAPACITY).fill(c));
  for (let i = 0; i < EMPTY_TUBES; i++) tubes.push([]);
  return tubes;
}

/** Scramble from a solved layout via valid pours — guarantees solvability. */
function scramble(numColors: number, shuffleMoves: number, rnd: () => number): Tubes {
  const state = cloneTubes(solvedState(numColors));
  let lastFrom = -1;
  let lastTo = -1;
  for (let m = 0; m < shuffleMoves; m++) {
    const indices = shuffled(state.map((_, i) => i), rnd);
    let poured = false;
    for (const from of indices) {
      if (state[from].length === 0) continue;
      const targets = shuffled(indices.filter((i) => i !== from), rnd);
      for (const to of targets) {
        if (from === lastTo && to === lastFrom) continue;
        if (!pour(state[from], state[to])) continue;
        lastFrom = from;
        lastTo = to;
        poured = true;
        break;
      }
      if (poured) break;
    }
    if (!poured) break;
  }
  if (isSolved(state)) {
    const fallback = cloneTubes(state);
    if (fallback[0].length > 0 && fallback[numColors].length < CAPACITY) {
      pour(fallback[0], fallback[numColors]);
    }
    return fallback;
  }
  return state;
}

function levelConfig(levelIdx: number): { colors: number; shuffle: number; parMoves: number } {
  const tier = escalateTier(levelIdx, 5, 1);
  const colors = 3 + tier;
  const shuffle = 10 + tier * 6;
  const parMoves = colors * 5 + tier * 3;
  return { colors, shuffle, parMoves };
}

function render(mount: HTMLElement): void {
  function startSession(seed: number): void {
    const rnd = mulberry32(seed);
    let levelIdx = 0;
    let totalScore = 0;
    const sessionStart = Date.now();
    let levelCleanup: (() => void) | null = null;

    function loadLevel(): void {
      if (levelCleanup) levelCleanup();
      mount.innerHTML = '';

      const { colors, shuffle, parMoves } = levelConfig(levelIdx);
      let tubes = scramble(colors, shuffle, rnd);
      const undoStack: Tubes[] = [];
      let moves = 0;
      let selected: number | null = null;
      let locked = false;
      const levelStart = Date.now();

      const hint = el('p', { class: 'ws-hint', text: 'Tap a tube, then tap another to pour.' });
      const toolbar = el('div', { class: 'ws-toolbar' });
      const undoBtn = el('button', {
        type: 'button',
        class: 'btn ws-undo',
        text: '↩ Undo',
        onclick: () => undo(),
      });
      toolbar.appendChild(undoBtn);
      const board = el('div', { class: 'ws-board' });
      const row = el('div', { class: 'ws-tubes', role: 'group', 'aria-label': 'Water tubes' });
      board.appendChild(hint);
      board.appendChild(toolbar);
      board.appendChild(row);
      mount.appendChild(board);

      if (levelIdx === 0) {
        showFirstRunHint('water-sort', toast);
      }

      setLQHeader({
        round: `${levelIdx + 1}/${LEVELS}`,
        score: String(totalScore),
        moves: '0',
      });

      function paint(): void {
        row.innerHTML = '';
        tubes.forEach((tube, idx) => {
          const tubeEl = el('div', {
            class: 'ws-tube'
              + (selected === idx ? ' ws-tube--sel' : '')
              + (selected != null && selected !== idx && canPour(tubes[selected], tube) ? ' ws-tube--target' : ''),
            role: 'button',
            'aria-label': `Tube ${idx + 1}`,
            onclick: () => onTap(idx),
          });
          if (tube.length === 0) {
            tubeEl.appendChild(el('div', { class: 'ws-seg', style: 'visibility:hidden' }));
          } else {
            for (const colorId of tube) {
              tubeEl.appendChild(el('div', {
                class: 'ws-seg',
                'data-color': String(colorId),
                style: `background:${LIQUID[(colorId - 1) % LIQUID.length]}`,
              }));
            }
          }
          row.appendChild(tubeEl);
        });
        setLQHeader({ moves: String(moves) });
        undoBtn.toggleAttribute('disabled', undoStack.length === 0);
      }

      function pushUndo(): void {
        undoStack.push(cloneTubes(tubes));
        if (undoStack.length > 40) undoStack.shift();
      }

      function undo(): void {
        if (locked || !undoStack.length) return;
        tubes = undoStack.pop()!;
        moves = Math.max(0, moves - 1);
        selected = null;
        sound('click');
        paint();
      }

      function onTap(idx: number): void {
        if (locked) return;
        if (selected == null) {
          if (tubes[idx].length === 0) {
            toast('Pick a tube with liquid');
            return;
          }
          selected = idx;
          sound('click');
          paint();
          return;
        }
        if (selected === idx) {
          selected = null;
          paint();
          return;
        }
        if (!pour(tubes[selected], tubes[idx])) {
          sound('bad');
          toast('Can only pour onto matching color or empty tube');
          selected = null;
          paint();
          return;
        }
        pushUndo();
        sound('good');
        moves++;
        selected = null;
        paint();
        if (isSolved(tubes)) finishLevel();
      }

      function finishLevel(): void {
        locked = true;
        board.classList.add('ws-win-flash');
        sound('win');
        const elapsedMs = Date.now() - levelStart;
        const moveBonus = Math.max(0, parMoves - moves) * 12;
        const levelScore = puzzleCompletionScore(elapsedMs, 0, { budgetSec: 360, base: 80 }) + moveBonus;
        totalScore += levelScore;
        levelIdx++;
        emitLQLevelComplete(levelIdx, totalScore);
        setLQHeader({
          round: `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`,
          score: String(totalScore),
        });
        if (levelIdx >= LEVELS) {
          const sessionMs = Date.now() - sessionStart;
          finishLQRound(
            totalScore,
            totalScore >= host.winScore,
            `${LEVELS}/${LEVELS} levels · ${moves} moves last`,
            sessionMs,
          );
        } else {
          setTimeout(loadLevel, 700);
        }
      }

      paint();
      levelCleanup = () => { /* no listeners to detach */ };
    }

    loadLevel();
  }

  startSession(Math.floor(Math.random() * 1e9));
}

mountLQ('water-sort', render, {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
