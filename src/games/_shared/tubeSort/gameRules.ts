/** Tube-sort puzzle rules — shared by water-sort and ball-sort. */

export const DEFAULT_CAPACITY = 4;

export type Tube = number[];
export type Tubes = Tube[];

export interface TubeModifier {
  capacity: number;
  locked: boolean;
  hiddenBottom: number;
}

export interface LevelModifiers {
  tubeMods: TubeModifier[];
  emptyTubes: number;
}

export function defaultTubeModifier(): TubeModifier {
  return { capacity: DEFAULT_CAPACITY, locked: false, hiddenBottom: 0 };
}

export function cloneTubes(tubes: Tubes): Tubes {
  return tubes.map((t) => t.slice());
}

export function tubeCapacity(mods: LevelModifiers, idx: number): number {
  return mods.tubeMods[idx]?.capacity ?? DEFAULT_CAPACITY;
}

export function tubeHiddenBottom(mods: LevelModifiers, idx: number): number {
  return mods.tubeMods[idx]?.hiddenBottom ?? 0;
}

/** Bottom layer index 0; hidden layers reveal when they become the top segment. */
export function isLayerRevealed(tube: Tube, layerIndex: number, hiddenBottom: number): boolean {
  if (hiddenBottom <= 0 || tube.length === 0) return true;
  const hiddenCount = Math.min(hiddenBottom, tube.length);
  const firstVisibleIdx = tube.length - hiddenCount;
  return layerIndex >= firstVisibleIdx;
}

export function topRunLength(tube: Tube): number {
  if (tube.length === 0) return 0;
  const c = tube[tube.length - 1];
  let n = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === c; i--) n++;
  return n;
}

export function isTubeComplete(tube: Tube, capacity: number): boolean {
  if (tube.length === 0) return false;
  if (tube.length !== capacity) return false;
  const c = tube[0];
  return tube.every((x) => x === c);
}

export function anyTubeComplete(tubes: Tubes, mods: LevelModifiers): boolean {
  for (let i = 0; i < tubes.length; i++) {
    if (isTubeComplete(tubes[i], tubeCapacity(mods, i))) return true;
  }
  return false;
}

export function isPourSourceLocked(mods: LevelModifiers, fromIdx: number, tubes: Tubes): boolean {
  if (!mods.tubeMods[fromIdx]?.locked) return false;
  return !anyTubeComplete(tubes, mods);
}

export function canPour(
  from: Tube,
  to: Tube,
  fromIdx: number,
  toIdx: number,
  tubes: Tubes,
  mods: LevelModifiers,
): boolean {
  if (from.length === 0 || fromIdx === toIdx) return false;
  if (isPourSourceLocked(mods, fromIdx, tubes)) return false;
  const toCap = tubeCapacity(mods, toIdx);
  if (to.length >= toCap) return false;
  if (to.length === 0) return true;
  return to[to.length - 1] === from[from.length - 1];
}

export function pourAmount(from: Tube, to: Tube, toIdx: number, mods: LevelModifiers): number {
  const toCap = tubeCapacity(mods, toIdx);
  return Math.min(topRunLength(from), toCap - to.length);
}

export function pour(
  from: Tube,
  to: Tube,
  fromIdx: number,
  toIdx: number,
  tubes: Tubes,
  mods: LevelModifiers,
): number {
  if (!canPour(from, to, fromIdx, toIdx, tubes, mods)) return 0;
  const amount = pourAmount(from, to, toIdx, mods);
  for (let i = 0; i < amount; i++) to.push(from.pop()!);
  return amount;
}

export function isSolved(tubes: Tubes, mods: LevelModifiers): boolean {
  for (let i = 0; i < tubes.length; i++) {
    const t = tubes[i];
    if (t.length === 0) continue;
    const cap = tubeCapacity(mods, i);
    if (!isTubeComplete(t, cap)) return false;
  }
  return true;
}

export function tubesKey(tubes: Tubes): string {
  return tubes.map((t) => t.join(',')).join('|');
}

/** Score a candidate pour — prefers completing tubes and clearing sources. */
function scorePour(
  tubes: Tubes,
  mods: LevelModifiers,
  from: number,
  to: number,
): number {
  const snap = cloneTubes(tubes);
  pour(snap[from], snap[to], from, to, snap, mods);
  let score = 0;
  if (isTubeComplete(snap[to], tubeCapacity(mods, to))) score += 6;
  if (snap[from].length === 0) score += 4;
  if (tubes[to].length === 0) score += 2;
  if (pourAmount(tubes[from], tubes[to], to, mods) > 1) score += 1;
  return score;
}

/** Suggest one valid pour (greedy — fast for hint UI). */
export function findHintMove(
  tubes: Tubes,
  mods: LevelModifiers,
): { from: number; to: number } | null {
  let best: { from: number; to: number; score: number } | null = null;
  for (let from = 0; from < tubes.length; from++) {
    if (tubes[from].length === 0 || isPourSourceLocked(mods, from, tubes)) continue;
    for (let to = 0; to < tubes.length; to++) {
      if (from === to) continue;
      if (!canPour(tubes[from], tubes[to], from, to, tubes, mods)) continue;
      const score = scorePour(tubes, mods, from, to);
      if (!best || score > best.score) best = { from, to, score };
    }
  }
  return best ? { from: best.from, to: best.to } : null;
}
