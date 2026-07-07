// Ball Sort — sort colored balls into tubes (same rules as Water Sort). Native GoPlay game.
import '../../styles/base.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, mulberry32, shuffled, sound, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { escalateTier } from '../../platform/freeDifficulty';
import { createHost } from '../../platform/gameHost';

const CAPACITY = 4;
const LEVELS = 3;
const EMPTY_TUBES = 2;
const BALL = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#6c5ce7'];

type Tube = number[];
type Tubes = Tube[];
const host = createHost('ball-sort');

function topRunLength(tube: Tube): number {
  if (!tube.length) return 0;
  const c = tube[tube.length - 1];
  let n = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === c; i--) n++;
  return n;
}

function canPour(from: Tube, to: Tube): boolean {
  if (!from.length || from === to) return false;
  if (to.length >= CAPACITY) return false;
  if (!to.length) return true;
  return to[to.length - 1] === from[from.length - 1];
}

function pour(from: Tube, to: Tube): boolean {
  if (!canPour(from, to)) return false;
  const n = Math.min(topRunLength(from), CAPACITY - to.length);
  for (let i = 0; i < n; i++) to.push(from.pop()!);
  return true;
}

function isSolved(tubes: Tubes): boolean {
  for (const t of tubes) {
    if (!t.length) continue;
    if (t.length !== CAPACITY) return false;
    if (!t.every((x) => x === t[0])) return false;
  }
  return true;
}

function solvedState(n: number): Tubes {
  const tubes: Tubes = [];
  for (let c = 1; c <= n; c++) tubes.push(Array(CAPACITY).fill(c));
  for (let i = 0; i < EMPTY_TUBES; i++) tubes.push([]);
  return tubes;
}

function scramble(n: number, moves: number, rnd: () => number): Tubes {
  const state = solvedState(n).map((t) => t.slice());
  let lastFrom = -1;
  let lastTo = -1;
  for (let m = 0; m < moves; m++) {
    const idx = shuffled(state.map((_, i) => i), rnd);
    let ok = false;
    for (const from of idx) {
      if (!state[from].length) continue;
      for (const to of shuffled(idx.filter((i) => i !== from), rnd)) {
        if (from === lastTo && to === lastFrom) continue;
        if (!pour(state[from], state[to])) continue;
        lastFrom = from;
        lastTo = to;
        ok = true;
        break;
      }
      if (ok) break;
    }
    if (!ok) break;
  }
  if (isSolved(state) && state[0].length && state[n].length < CAPACITY) {
    pour(state[0], state[n]);
  }
  return state;
}

function levelConfig(i: number): { colors: number; shuffle: number; par: number } {
  const tier = escalateTier(i, 2, 1);
  return { colors: 3 + tier, shuffle: 12 + tier * 5, par: (3 + tier) * 5 + tier * 3 };
}

function render(mount: HTMLElement): void {
  const rnd = mulberry32((Math.random() * 1e9) | 0);
  let levelIdx = 0;
  let totalScore = 0;
  const sessionStart = Date.now();

  function loadLevel(): void {
    mount.innerHTML = '';
    const { colors, shuffle, par } = levelConfig(levelIdx);
    const tubes = scramble(colors, shuffle, rnd);
    let moves = 0;
    let selected: number | null = null;
    let locked = false;
    const levelStart = Date.now();

    const wrap = el('div', { class: 'bs-board' });
    wrap.appendChild(el('p', { class: 'bs-hint', text: 'Move balls between tubes — same color only.' }));
    const row = el('div', { class: 'bs-tubes' });
    wrap.appendChild(row);
    mount.appendChild(wrap);

    setLQHeader({ round: `${levelIdx + 1}/${LEVELS}`, score: String(totalScore), moves: '0' });

    function paint(): void {
      row.innerHTML = '';
      tubes.forEach((tube, idx) => {
        const tubeEl = el('div', {
          class: 'bs-tube'
            + (selected === idx ? ' bs-tube--sel' : '')
            + (selected != null && selected !== idx && canPour(tubes[selected], tube) ? ' bs-tube--target' : ''),
          onclick: () => onTap(idx),
        });
        for (const id of tube) {
          tubeEl.appendChild(el('div', {
            class: 'bs-ball',
            style: `background:${BALL[(id - 1) % BALL.length]}`,
          }));
        }
        row.appendChild(tubeEl);
      });
      setLQHeader({ moves: String(moves) });
    }

    function onTap(idx: number): void {
      if (locked) return;
      if (selected == null) {
        if (!tubes[idx].length) { toast('Pick a tube with balls'); return; }
        selected = idx;
        sound('click');
        paint();
        return;
      }
      if (selected === idx) { selected = null; paint(); return; }
      if (!pour(tubes[selected], tubes[idx])) {
        sound('bad');
        toast('Only onto matching color or empty tube');
        selected = null;
        paint();
        return;
      }
      sound('good');
      moves++;
      selected = null;
      paint();
      if (isSolved(tubes)) {
        locked = true;
        wrap.classList.add('bs-win-flash');
        sound('win');
        const bonus = Math.max(0, par - moves) * 12;
        totalScore += puzzleCompletionScore(Date.now() - levelStart, 0, { budgetSec: 360, base: 85 }) + bonus;
        levelIdx++;
        setLQHeader({ round: `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`, score: String(totalScore) });
        if (levelIdx >= LEVELS) {
          finishLQRound(totalScore, totalScore >= host.winScore, `${LEVELS}/${LEVELS} levels`, Date.now() - sessionStart);
        } else {
          setTimeout(loadLevel, 700);
        }
      }
    }

    paint();
  }

  loadLevel();
}

mountLQ('ball-sort', render, {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
