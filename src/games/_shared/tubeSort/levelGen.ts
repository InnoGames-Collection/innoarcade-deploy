/** Level generation — mixed-color starts with modifiers and BFS solvability check. */

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
  type PourStyle,
  type TubeModifier,
  type Tubes,
} from './gameRules';

export const LEVEL_COUNT = 8;
const NARROW_CAPACITY = 3;
const MAX_SOLVE_STATES = 8_000;
const MAX_SOLVE_STATES_SINGLE = 12_000;
const SOLVE_TIME_MS = 120;
const SOLVE_TIME_MS_SINGLE = 180;
const MAX_GEN_ATTEMPTS = 24;

export type ModifierKind = 'hidden' | 'locked' | 'narrow' | 'singleBuffer';

export interface LevelSpec {
  colors: number;
  shuffle: number;
  parMoves: number;
  modifiers: ModifierKind[];
}

/** Water sort — full top-run pours; shuffle ramps complexity. */
export const LEVEL_SPECS: LevelSpec[] = [
  { colors: 3, shuffle: 14, parMoves: 14, modifiers: [] },
  { colors: 4, shuffle: 20, parMoves: 18, modifiers: [] },
  { colors: 4, shuffle: 28, parMoves: 22, modifiers: [] },
  { colors: 5, shuffle: 34, parMoves: 28, modifiers: ['hidden'] },
  { colors: 5, shuffle: 40, parMoves: 32, modifiers: ['locked'] },
  { colors: 6, shuffle: 48, parMoves: 36, modifiers: ['narrow'] },
  { colors: 6, shuffle: 56, parMoves: 40, modifiers: ['singleBuffer'] },
  { colors: 7, shuffle: 64, parMoves: 46, modifiers: ['hidden', 'locked'] },
];

/** Ball sort — one ball per move; higher par budgets. */
export const BALL_LEVEL_SPECS: LevelSpec[] = [
  { colors: 3, shuffle: 18, parMoves: 32, modifiers: [] },
  { colors: 4, shuffle: 26, parMoves: 42, modifiers: [] },
  { colors: 4, shuffle: 34, parMoves: 50, modifiers: [] },
  { colors: 5, shuffle: 42, parMoves: 58, modifiers: ['hidden'] },
  { colors: 5, shuffle: 50, parMoves: 66, modifiers: ['locked'] },
  { colors: 6, shuffle: 58, parMoves: 74, modifiers: ['narrow'] },
  { colors: 6, shuffle: 66, parMoves: 82, modifiers: ['singleBuffer'] },
  { colors: 7, shuffle: 74, parMoves: 92, modifiers: ['hidden', 'locked'] },
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

function ensurePlayable(tubes: Tubes, mods: LevelModifiers, pourStyle: PourStyle): void {
  if (!isSolved(tubes, mods)) return;
  for (let from = 0; from < tubes.length; from++) {
    if (tubes[from].length === 0) continue;
    for (let to = 0; to < tubes.length; to++) {
      if (from === to) continue;
      if (pour(tubes[from], tubes[to], from, to, tubes, mods, pourStyle) && !isSolved(tubes, mods)) return;
    }
  }
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

/** Randomly distribute color layers across tubes — guarantees mixed stacks. */
function mixedState(numColors: number, emptyTubes: number, rnd: () => number): Tubes {
  const segments: number[] = [];
  for (let c = 1; c <= numColors; c++) {
    for (let i = 0; i < DEFAULT_CAPACITY; i++) segments.push(c);
  }
  const needMixed = Math.min(2, Math.max(1, numColors - 1));
  let tubes: Tubes = [];
  for (let attempt = 0; attempt < 24; attempt++) {
    const shuffledSegs = shuffled(segments, rnd);
    tubes = [];
    for (let t = 0; t < numColors; t++) {
      tubes.push(shuffledSegs.slice(t * DEFAULT_CAPACITY, (t + 1) * DEFAULT_CAPACITY));
    }
    if (countMixedTubes(tubes) >= needMixed) break;
  }
  for (let i = 0; i < emptyTubes; i++) tubes.push([]);
  return tubes;
}

function tubeColorVariety(tube: number[]): number {
  return new Set(tube).size;
}

function countMixedTubes(tubes: Tubes): number {
  return tubes.filter((t) => t.length >= 2 && tubeColorVariety(t) >= 2).length;
}

function minMixedTubes(levelIdx: number, numColors: number): number {
  return Math.min(2 + Math.floor(levelIdx / 2), Math.max(1, numColors - 1));
}

function scramblePour(
  from: number[],
  to: number[],
  fromIdx: number,
  toIdx: number,
  tubes: Tubes,
  mods: LevelModifiers,
  pourStyle: PourStyle,
): boolean {
  if (pourStyle === 'single') {
    return pourOneLayer(from, to, fromIdx, toIdx, tubes, mods);
  }
  return pour(from, to, fromIdx, toIdx, tubes, mods, pourStyle) > 0;
}

function scramble(
  numColors: number,
  shuffleMoves: number,
  mods: LevelModifiers,
  rnd: () => number,
  pourStyle: PourStyle,
  levelIdx = 0,
): Tubes {
  const minMixed = pourStyle === 'single' ? 1 : minMixedTubes(levelIdx, numColors);
  const maxTries = pourStyle === 'single' ? 10 : 8;
  for (let tryIdx = 0; tryIdx < maxTries; tryIdx++) {
    const state = cloneTubes(solvedState(numColors, mods.emptyTubes));
    let lastFrom = -1;
    let lastTo = -1;
    const moves = shuffleMoves + tryIdx * 3;
    for (let m = 0; m < moves; m++) {
      const indices = shuffled(state.map((_, i) => i), rnd);
      let poured = false;
      for (const from of indices) {
        if (state[from].length === 0) continue;
        const targets = shuffled(indices.filter((i) => i !== from), rnd);
        for (const to of targets) {
          if (from === lastTo && to === lastFrom) continue;
          if (!scramblePour(state[from], state[to], from, to, state, mods, pourStyle)) continue;
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
      ensurePlayable(state, mods, pourStyle);
    }
    if (!isSolved(state, mods) && countMixedTubes(state) >= minMixed) return state;
  }
  const fallback = cloneTubes(solvedState(numColors, mods.emptyTubes));
  ensurePlayable(fallback, mods, pourStyle);
  return fallback;
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

export function hasOpeningMove(tubes: Tubes, mods: LevelModifiers): boolean {
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

/** Bounded BFS — used when locked tubes or single-ball rules need verification. */
export function isSolvable(tubes: Tubes, mods: LevelModifiers, pourStyle: PourStyle = 'run'): boolean {
  if (isSolved(tubes, mods)) return false;
  if (!hasOpeningMove(tubes, mods)) return false;
  const maxStates = pourStyle === 'single' ? MAX_SOLVE_STATES_SINGLE : MAX_SOLVE_STATES;
  const timeMs = pourStyle === 'single' ? SOLVE_TIME_MS_SINGLE : SOLVE_TIME_MS;
  const deadline = performance.now() + timeMs;
  const start = tubesKey(tubes);
  const seen = new Set<string>([start]);
  const queue: Tubes[] = [cloneTubes(tubes)];
  let head = 0;
  while (head < queue.length && seen.size < maxStates) {
    if (performance.now() > deadline) return pourStyle !== 'single';
    const state = queue[head++];
    for (let from = 0; from < state.length; from++) {
      if (state[from].length === 0 || isPourSourceLocked(mods, from, state)) continue;
      for (let to = 0; to < state.length; to++) {
        if (from === to) continue;
        const next = cloneTubes(state);
        const moved = pour(next[from], next[to], from, to, next, mods, pourStyle);
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

function acceptLevel(
  tubes: Tubes,
  mods: LevelModifiers,
  kinds: ModifierKind[],
  pourStyle: PourStyle,
  levelIdx: number,
  numColors: number,
): boolean {
  if (isSolved(tubes, mods) || !hasOpeningMove(tubes, mods)) return false;
  if (pourStyle === 'run' && countMixedTubes(tubes) < minMixedTubes(levelIdx, numColors)) return false;
  if (pourStyle === 'single' && countMixedTubes(tubes) < 1) return false;
  // Run-mode levels without modifiers are scrambled from solved — always winnable.
  if (pourStyle === 'run' && kinds.length === 0) return true;
  if (needsSolvabilityCheck(kinds) || kinds.length > 0) {
    return isSolvable(tubes, mods, pourStyle);
  }
  return true;
}

function fallbackLevel(
  spec: LevelSpec,
  rnd: () => number,
  pourStyle: PourStyle,
  levelIdx: number,
): GeneratedLevel {
  const fallbackMods: LevelModifiers = {
    emptyTubes: 2,
    tubeMods: Array.from({ length: spec.colors + 2 }, () => defaultTubeModifier()),
  };
  for (let attempt = 0; attempt < 20; attempt++) {
    const tubes = pourStyle === 'single'
      ? scramble(spec.colors, Math.max(10, spec.shuffle - 4) + attempt * 2, fallbackMods, rnd, pourStyle, levelIdx)
      : scramble(spec.colors, Math.max(10, spec.shuffle - 4) + attempt * 2, fallbackMods, rnd, pourStyle, levelIdx);
    ensurePlayable(tubes, fallbackMods, pourStyle);
    const mixedOk = pourStyle === 'single'
      ? countMixedTubes(tubes) >= 1
      : countMixedTubes(tubes) >= minMixedTubes(levelIdx, spec.colors);
    if (!isSolved(tubes, fallbackMods) && mixedOk && hasOpeningMove(tubes, fallbackMods)) {
      if (pourStyle === 'run' || isSolvable(tubes, fallbackMods, pourStyle)) {
        return { tubes, mods: fallbackMods, spec: { ...spec, modifiers: [] } };
      }
    }
  }
  if (spec.modifiers.length > 0) {
    return generateFromSpec(
      { ...spec, shuffle: Math.max(10, spec.shuffle - 8), modifiers: [] },
      rnd,
      pourStyle,
      levelIdx,
    );
  }
  const tubes = mixedState(spec.colors, fallbackMods.emptyTubes, rnd);
  ensurePlayable(tubes, fallbackMods, pourStyle);
  return { tubes, mods: fallbackMods, spec: { ...spec, modifiers: [] } };
}

export function levelSpec(levelIdx: number, pourStyle: PourStyle = 'run'): LevelSpec {
  const specs = pourStyle === 'single' ? BALL_LEVEL_SPECS : LEVEL_SPECS;
  return specs[Math.min(levelIdx, specs.length - 1)];
}

function generateFromSpec(spec: LevelSpec, rnd: () => number, pourStyle: PourStyle, levelIdx: number): GeneratedLevel {
  const baseMods = buildBaseModifiers(spec.colors, spec.modifiers);

  for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
    const mods: LevelModifiers = {
      emptyTubes: baseMods.emptyTubes,
      tubeMods: baseMods.tubeMods.map((m) => ({ ...m })),
    };
    const shuffleMoves = spec.shuffle + (attempt > 0 ? attempt * 3 : 0);
    const tubes = scramble(spec.colors, shuffleMoves, mods, rnd, pourStyle, levelIdx);
    while (mods.tubeMods.length < tubes.length) {
      mods.tubeMods.push(defaultTubeModifier());
    }
    applyModifiers(tubes, mods, spec.modifiers, rnd);
    if (acceptLevel(tubes, mods, spec.modifiers, pourStyle, levelIdx, spec.colors)) {
      ensurePlayable(tubes, mods, pourStyle);
      return { tubes, mods, spec };
    }
  }

  return fallbackLevel(spec, rnd, pourStyle, levelIdx);
}

export function generateLevel(levelIdx: number, rnd: () => number, pourStyle: PourStyle = 'run'): GeneratedLevel {
  return generateFromSpec(levelSpec(levelIdx, pourStyle), rnd, pourStyle, levelIdx);
}

export function generateLevelWithSpec(
  spec: LevelSpec,
  rnd: () => number,
  pourStyle: PourStyle = 'run',
  levelIdx = 0,
): GeneratedLevel {
  return generateFromSpec(spec, rnd, pourStyle, levelIdx);
}
