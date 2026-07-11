// Parking Jam — slide cars to free the red exit vehicle. Native GoPlay brain game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, sound, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';

const LEVELS = 8;
const CELL = 42;
const GAP = 2;
const host = createHost('parking-jam');

interface Car {
  id: number;
  r: number;
  c: number;
  len: number;
  horiz: boolean;
  exit?: boolean;
}

interface LevelDef {
  w: number;
  h: number;
  exitRow: number;
  cars: Car[];
  par: number;
}

const LEVELS_DEF: LevelDef[] = [
  {
    w: 6, h: 6, exitRow: 2, par: 8,
    cars: [
      { id: 1, r: 2, c: 0, len: 2, horiz: true, exit: true },
      { id: 2, r: 0, c: 2, len: 2, horiz: false },
      { id: 3, r: 4, c: 2, len: 2, horiz: false },
      { id: 4, r: 1, c: 4, len: 2, horiz: false },
      { id: 5, r: 0, c: 0, len: 2, horiz: false },
      { id: 6, r: 3, c: 5, len: 2, horiz: false },
    ],
  },
  {
    w: 6, h: 6, exitRow: 2, par: 14,
    cars: [
      { id: 1, r: 2, c: 0, len: 2, horiz: true, exit: true },
      { id: 2, r: 0, c: 0, len: 2, horiz: false },
      { id: 3, r: 0, c: 3, len: 2, horiz: false },
      { id: 4, r: 2, c: 2, len: 3, horiz: false },
      { id: 5, r: 3, c: 0, len: 3, horiz: false },
      { id: 6, r: 3, c: 4, len: 2, horiz: false },
      { id: 7, r: 5, c: 1, len: 2, horiz: true },
      { id: 8, r: 0, c: 5, len: 2, horiz: false },
    ],
  },
  {
    w: 6, h: 6, exitRow: 2, par: 20,
    cars: [
      { id: 1, r: 2, c: 0, len: 2, horiz: true, exit: true },
      { id: 2, r: 0, c: 0, len: 3, horiz: false },
      { id: 3, r: 0, c: 3, len: 2, horiz: false },
      { id: 4, r: 0, c: 5, len: 2, horiz: false },
      { id: 5, r: 2, c: 2, len: 3, horiz: false },
      { id: 6, r: 3, c: 0, len: 2, horiz: true },
      { id: 7, r: 4, c: 3, len: 2, horiz: false },
      { id: 8, r: 5, c: 0, len: 2, horiz: true },
      { id: 9, r: 5, c: 3, len: 2, horiz: true },
    ],
  },
  {
    w: 6, h: 6, exitRow: 2, par: 10,
    cars: [
      { id: 1, r: 2, c: 0, len: 2, horiz: true, exit: true },
      { id: 2, r: 0, c: 1, len: 2, horiz: false },
      { id: 3, r: 1, c: 3, len: 2, horiz: false },
      { id: 4, r: 3, c: 2, len: 2, horiz: true },
      { id: 5, r: 4, c: 4, len: 2, horiz: false },
      { id: 6, r: 5, c: 0, len: 2, horiz: true },
    ],
  },
  {
    w: 6, h: 6, exitRow: 2, par: 16,
    cars: [
      { id: 1, r: 2, c: 0, len: 2, horiz: true, exit: true },
      { id: 2, r: 0, c: 0, len: 2, horiz: false },
      { id: 3, r: 0, c: 3, len: 2, horiz: true },
      { id: 4, r: 1, c: 5, len: 2, horiz: false },
      { id: 5, r: 3, c: 1, len: 3, horiz: false },
      { id: 6, r: 4, c: 3, len: 2, horiz: true },
      { id: 7, r: 5, c: 1, len: 2, horiz: true },
    ],
  },
  {
    w: 6, h: 6, exitRow: 2, par: 18,
    cars: [
      { id: 1, r: 2, c: 0, len: 2, horiz: true, exit: true },
      { id: 2, r: 0, c: 2, len: 2, horiz: false },
      { id: 3, r: 0, c: 4, len: 2, horiz: false },
      { id: 4, r: 2, c: 3, len: 2, horiz: false },
      { id: 5, r: 3, c: 0, len: 2, horiz: true },
      { id: 6, r: 4, c: 2, len: 3, horiz: false },
      { id: 7, r: 5, c: 4, len: 2, horiz: true },
      { id: 8, r: 1, c: 0, len: 2, horiz: false },
    ],
  },
  {
    w: 6, h: 6, exitRow: 2, par: 22,
    cars: [
      { id: 1, r: 2, c: 0, len: 2, horiz: true, exit: true },
      { id: 2, r: 0, c: 0, len: 3, horiz: false },
      { id: 3, r: 0, c: 4, len: 2, horiz: false },
      { id: 4, r: 2, c: 2, len: 3, horiz: false },
      { id: 5, r: 3, c: 4, len: 2, horiz: false },
      { id: 6, r: 4, c: 0, len: 2, horiz: true },
      { id: 7, r: 5, c: 2, len: 2, horiz: true },
      { id: 8, r: 1, c: 5, len: 2, horiz: false },
      { id: 9, r: 4, c: 5, len: 2, horiz: false },
    ],
  },
  {
    w: 6, h: 6, exitRow: 2, par: 24,
    cars: [
      { id: 1, r: 2, c: 0, len: 2, horiz: true, exit: true },
      { id: 2, r: 0, c: 1, len: 2, horiz: false },
      { id: 3, r: 0, c: 3, len: 2, horiz: false },
      { id: 4, r: 0, c: 5, len: 2, horiz: false },
      { id: 5, r: 2, c: 2, len: 3, horiz: false },
      { id: 6, r: 3, c: 0, len: 2, horiz: true },
      { id: 7, r: 4, c: 3, len: 2, horiz: false },
      { id: 8, r: 5, c: 0, len: 3, horiz: true },
      { id: 9, r: 5, c: 4, len: 2, horiz: true },
    ],
  },
];

function cloneCars(cars: Car[]): Car[] {
  return cars.map((c) => ({ ...c }));
}

function occupies(cars: Car[], r: number, c: number, skipId?: number): boolean {
  for (const car of cars) {
    if (car.id === skipId) continue;
    if (car.horiz) {
      if (car.r === r && c >= car.c && c < car.c + car.len) return true;
    } else if (car.c === c && r >= car.r && r < car.r + car.len) return true;
  }
  return false;
}

function canStep(car: Car, cars: Car[], dr: number, dc: number, w: number, h: number): boolean {
  if (car.horiz) {
    if (dr !== 0) return false;
    const nc = dc < 0 ? car.c - 1 : car.c + car.len;
    if (nc < 0 || nc >= w) return false;
    const r = car.r;
    return !occupies(cars, r, nc, car.id);
  }
  if (dc !== 0) return false;
  const nr = dr < 0 ? car.r - 1 : car.r + car.len;
  if (nr < 0 || nr >= h) return false;
  const c = car.c;
  return !occupies(cars, nr, c, car.id);
}

function slide(car: Car, cars: Car[], dr: number, dc: number, w: number, h: number): number {
  let steps = 0;
  while (canStep(car, cars, dr, dc, w, h)) {
    car.c += dc;
    car.r += dr;
    steps++;
  }
  return steps;
}

function isWin(cars: Car[], def: LevelDef): boolean {
  const exit = cars.find((c) => c.exit);
  return !!exit && exit.c + exit.len >= def.w;
}

function render(mount: HTMLElement): void {
  let levelIdx = 0;
  let totalScore = 0;
  const sessionStart = Date.now();

  function loadLevel(): void {
    mount.innerHTML = '';
    const def = LEVELS_DEF[levelIdx];
    const cars = cloneCars(def.cars);
    let moves = 0;
    let selected: number | null = null;
    let locked = false;
    const levelStart = Date.now();

    const wrap = el('div', { class: 'pj-board-wrap' });
    const lot = el('div', { class: 'pj-lot' });
    const gridW = def.w * CELL + (def.w - 1) * GAP;
    const gridH = def.h * CELL + (def.h - 1) * GAP;
    lot.style.width = gridW + 16 + 'px';
    lot.style.height = gridH + 16 + 'px';

    const grid = el('div', {
      class: 'pj-grid',
      style: `grid-template-columns:repeat(${def.w},1fr);width:${gridW}px;height:${gridH}px`,
    });
    for (let i = 0; i < def.w * def.h; i++) grid.appendChild(el('div', { class: 'pj-cell' }));
    lot.appendChild(grid);

    const exitMark = el('div', {
      class: 'pj-exit',
      style: `top:${8 + def.exitRow * (CELL + GAP) + (CELL - 44) / 2}px`,
    });
    lot.appendChild(exitMark);

    const ctrl = el('div', { class: 'pj-controls' });
    const btnBack = el('button', { class: 'btn', text: '◀', onclick: () => moveSelected(-1) });
    const btnFwd = el('button', { class: 'btn', text: '▶', onclick: () => moveSelected(1) });
    ctrl.appendChild(btnBack);
    ctrl.appendChild(btnFwd);

    wrap.appendChild(lot);
    wrap.appendChild(ctrl);
    mount.appendChild(wrap);

    setLQHeader({ round: `${levelIdx + 1}/${LEVELS}`, score: String(totalScore), moves: '0' });

    function carStyle(car: Car): string {
      const left = car.c * (CELL + GAP);
      const top = car.r * (CELL + GAP);
      if (car.horiz) {
        return `left:${left}px;top:${top}px;width:${car.len * CELL + (car.len - 1) * GAP}px;height:${CELL}px`;
      }
      return `left:${left}px;top:${top}px;width:${CELL}px;height:${car.len * CELL + (car.len - 1) * GAP}px`;
    }

    function paint(): void {
      lot.querySelectorAll('.pj-car').forEach((n) => n.remove());
      for (const car of cars) {
        lot.appendChild(el('div', {
          class: 'pj-car'
            + (car.exit ? ' pj-car--exit' : ' pj-car--norm')
            + (car.horiz ? ' pj-car--horiz' : ' pj-car--vert')
            + (selected === car.id ? ' pj-car--sel' : ''),
          style: carStyle(car),
          onclick: (e) => { e.stopPropagation(); onCar(car.id); },
        }));
      }
      const sel = selected != null ? cars.find((c) => c.id === selected) : null;
      const horiz = sel?.horiz ?? true;
      btnBack.textContent = horiz ? '◀' : '▲';
      btnFwd.textContent = horiz ? '▶' : '▼';
      btnBack.style.visibility = selected != null ? 'visible' : 'hidden';
      btnFwd.style.visibility = selected != null ? 'visible' : 'hidden';
      setLQHeader({ moves: String(moves) });
    }

    function onCar(id: number): void {
      if (locked) return;
      selected = selected === id ? null : id;
      sound('click');
      paint();
    }

    function moveSelected(sign: number): void {
      if (locked || selected == null) {
        toast('Select a car first');
        return;
      }
      const car = cars.find((c) => c.id === selected);
      if (!car) return;
      const dr = car.horiz ? 0 : sign;
      const dc = car.horiz ? sign : 0;
      const steps = slide(car, cars, dr, dc, def.w, def.h);
      if (steps === 0) {
        sound('bad');
        return;
      }
      sound('good');
      moves++;
      paint();
      if (isWin(cars, def)) finishLevel();
    }

    function finishLevel(): void {
      locked = true;
      sound('win');
      const elapsedMs = Date.now() - levelStart;
      const moveBonus = Math.max(0, def.par - moves) * 15;
      totalScore += puzzleCompletionScore(elapsedMs, 0, { budgetSec: 420, base: 90 }) + moveBonus;
      levelIdx++;
      setLQHeader({ round: `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`, score: String(totalScore) });
      if (levelIdx >= LEVELS) {
        finishLQRound(totalScore, totalScore >= host.winScore, `${LEVELS}/${LEVELS} lots cleared`, Date.now() - sessionStart);
      } else {
        setTimeout(loadLevel, 650);
      }
    }

    paint();
  }

  loadLevel();
}

mountLQ('parking-jam', render, {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});
