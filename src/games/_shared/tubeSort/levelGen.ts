/** Level generation — scramble-from-solved with modifiers and BFS solvability check. */

import { shuffled } from '../../_lq/rng';
import {
  DEFAULT_CAPACITY,
  canPour,
  cloneTubes,
  defaultTubeModifier,
  isPourSourceLocked,
  isSolved,
  pour,
  tubesKey,
  type LevelModifiers,
  type TubeModifier,
  type Tubes,
} from './gameRules';

export const LEVEL_COUNT = 8;
const NARROW_CAPACITY = 3;
const MAX_SOLVE_STATES = 4_000;
const SOLVE_TIME_MS = 45;
const MAX_GEN_ATTEMPTS = 18;

export type ModifierKind = 'hidden' | 'locked' | 'narrow' | 'singleBuffer';

export interface LevelSpec {
  colors: number;
  shuffle: number;
  parMoves: number;
  modifiers: ModifierKind[];
}

/** Fixed modifier curve — one new twist from level 4 onward (industry-standard ramp). */
export const LEVEL_SPECS: LevelSpec[] = [
  { colors: 3, shuffle: 10, parMoves: 14, modifiers: [] },
  { colors: 4, shuffle: 16, parMoves: 18, modifiers: [] },
  { colors: 4, shuffle: 22, parMoves: 22, modifiers: [] },
  { colors: 5, shuffle: 28, parMoves: 28, modifiers: ['hidden'] },
  { colors: 5, shuffle: 34, parMoves: 32, modifiers: ['locked'] },
  { colors: 6, shuffle: 40, parMoves: 36, modifiers: ['narrow'] },
  { colors: 6, shuffle: 46, parMoves: 40, modifiers: ['singleBuffer'] },
  { colors: 7, shuffle: 54, parMoves: 46, modifiers: ['hidden', 'locked'] },
];

export interface GeneratedLevel {
  tubes: Tubes;
  mods: LevelModifiers;
  spec: LevelSpec;
}

function pourOneLayer(
  from: number[],
  to: number[],
  fromIdx: number,
  toIdx: number,
  tubes: Tubes,
  mods: LevelModifiers,
): boolean {
  if (!canPour(from, to, fromIdx, toIdx, tubes, mods)) return false;
  to.push(from.pop()!);
  return true;
}

function ensurePlayable(tubes: Tubes, mods: LevelModifiers): void {
  if (!isSolved(tubes, mods)) return;
  for (let from = 0; from < tubes.length; from++) {
    if (tubes[from].length === 0) continue;
    for (let to = 0; to < tubes.length; to++) {
      if (from === to) continue;
      if (pourOneLayer(tubes[from], tubes[to], from, to, tubes, mods) && !isSolved(tubes, mods)) return;
    }
  }
}

function solvedState(numColors: number, emptyTubes: number): Tubes {
  const tubes: Tubes = [];
  for (let c = 1; c <= numColors; c++) tubes.push(Array(DEFAULT_CAPACITY).fill(c));
  for (let i = 0; i < emptyTubes; i++) tubes.push([]);
  return tubes;
}

function scramble(
  numColors: number,
  shuffleMoves: number,
  mods: LevelModifiers,
  rnd: () => number,
): Tubes {
  const state = cloneTubes(solvedState(numColors, mods.emptyTubes));
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
        if (!pour(state[from], state[to], from, to, state, mods)) continue;
        lastFrom = from;
        lastTo = to;
        poured = true;
        break;
      }
      if (poured) break;
    }
    if (!poured) break;
  }
  if (isSolved(state, mods)) {
    ensurePlayable(state, mods);
  }
  return state;
}

function buildBaseModifiers(numColors: number, kinds: ModifierKind[]): LevelModifiers {
  const emptyTubes = kinds.includes('singleBuffer') ? 1 : 2;
  const tubeCount = numColors + emptyTubes;
  const tubeMods: TubeModifier[] = Array.from({ length: tubeCount }, () => defaultTubeModifier());
  return { tubeMods, emptyTubes };
}

function applyModifiers(
  tubes: Tubes,
  mods: LevelModifiers,
  kinds: ModifierKind[],
  rnd: () => number,
): void {
  const liquidIndices = tubes
    .map((t, i) => (t.length > 0 ? i : -1))
    .filter((i) => i >= 0);
  const emptyIndices = tubes
    .map((t, i) => (t.length === 0 ? i : -1))
    .filter((i) => i >= 0);
  const pick = <T>(arr: T[]): T | undefined => {
    if (!arr.length) return undefined;
    return arr[Math.floor(rnd() * arr.length)];
  };

  if (kinds.includes('narrow')) {
    const idx = pick(emptyIndices) ?? pick(liquidIndices);
    if (idx != null) mods.tubeMods[idx] = { ...mods.tubeMods[idx], capacity: NARROW_CAPACITY };
  }

  if (kinds.includes('locked')) {
    const safe = liquidIndices.filter((i) => {
      if (tubes[i].length < 2) return false;
      for (let from = 0; from < tubes.length; from++) {
        if (from === i) continue;
        if (tubes[from].length === 0) continue;
        for (let to = 0; to < tubes.length; to++) {
          if (from === to) continue;
          if (canPour(tubes[from], tubes[to], from, to, tubes, mods)) return true;
        }
      }
      return false;
    });
    const idx = pick(safe.length ? safe : liquidIndices.filter((i) => tubes[i].length >= 2));
    if (idx != null) mods.tubeMods[idx] = { ...mods.tubeMods[idx], locked: true };
  }

  if (kinds.includes('hidden')) {
    const candidates = liquidIndices.filter((i) => tubes[i].length >= 2);
    const idx = pick(candidates.length ? candidates : liquidIndices);
    if (idx != null) mods.tubeMods[idx] = { ...mods.tubeMods[idx], hiddenBottom: 1 };
  }
}

function hasOpeningMove(tubes: Tubes, mods: LevelModifiers): boolean {
  for (let from = 0; from < tubes.length; from++) {
    if (tubes[from].length === 0 || isPourSourceLocked(mods, from, tubes)) continue;
    for (let to = 0; to < tubes.length; to++) {
      if (from === to) continue;
      if (canPour(tubes[from], tubes[to], from, to, tubes, mods)) return true;
    }
  }
  return false;
}

function needsSolvabilityCheck(kinds: ModifierKind[]): boolean {
  return kinds.includes('locked');
}

/** Bounded BFS — used only when locked tubes may block naive scramble guarantees. */
export function isSolvable(tubes: Tubes, mods: LevelModifiers): boolean {
  if (isSolved(tubes, mods)) return false;
  if (!hasOpeningMove(tubes, mods)) return false;
  const deadline = performance.now() + SOLVE_TIME_MS;
  const start = tubesKey(tubes);
  const seen = new Set<string>([start]);
  const queue: Tubes[] = [cloneTubes(tubes)];
  let head = 0;
  while (head < queue.length && seen.size < MAX_SOLVE_STATES) {
    if (performance.now() > deadline) return false;
    const state = queue[head++];
    for (let from = 0; from < state.length; from++) {
      if (state[from].length === 0 || isPourSourceLocked(mods, from, state)) continue;
      for (let to = 0; to < state.length; to++) {
        if (from === to) continue;
        const next = cloneTubes(state);
        const moved = pour(next[from], next[to], from, to, next, mods);
        if (!moved) continue;
        if (isSolved(next, mods)) return true;
        const key = tubesKey(next);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return false;
}

function acceptLevel(tubes: Tubes, mods: LevelModifiers, kinds: ModifierKind[]): boolean {
  if (isSolved(tubes, mods) || !hasOpeningMove(tubes, mods)) return false;
  if (needsSolvabilityCheck(kinds)) return isSolvable(tubes, mods);
  return true;
}

export function levelSpec(levelIdx: number): LevelSpec {
  return LEVEL_SPECS[Math.min(levelIdx, LEVEL_SPECS.length - 1)];
}

export function generateLevel(levelIdx: number, rnd: () => number): GeneratedLevel {
  const spec = levelSpec(levelIdx);
  const baseMods = buildBaseModifiers(spec.colors, spec.modifiers);

  for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
    const mods: LevelModifiers = {
      emptyTubes: baseMods.emptyTubes,
      tubeMods: baseMods.tubeMods.map((m) => ({ ...m })),
    };
    const shuffleMoves = spec.shuffle + (attempt > 0 ? attempt * 2 : 0);
    const tubes = scramble(spec.colors, shuffleMoves, mods, rnd);
    while (mods.tubeMods.length < tubes.length) {
      mods.tubeMods.push(defaultTubeModifier());
    }
    applyModifiers(tubes, mods, spec.modifiers, rnd);
    if (acceptLevel(tubes, mods, spec.modifiers)) {
      ensurePlayable(tubes, mods);
      return { tubes, mods, spec };
    }
  }

  const fallbackMods: LevelModifiers = {
    emptyTubes: 2,
    tubeMods: Array.from({ length: spec.colors + 2 }, () => defaultTubeModifier()),
  };
  for (let attempt = 0; attempt < 12; attempt++) {
    const tubes = scramble(spec.colors, Math.max(8, spec.shuffle - 8) + attempt * 2, fallbackMods, rnd);
    if (!isSolved(tubes, fallbackMods)) {
      return { tubes, mods: fallbackMods, spec: { ...spec, modifiers: [] } };
    }
  }
  const tubes = scramble(spec.colors, 12, fallbackMods, rnd);
  ensurePlayable(tubes, fallbackMods);
  return { tubes, mods: fallbackMods, spec: { ...spec, modifiers: [] } };
}
