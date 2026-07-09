/** Session meta — daily challenge seed, gem collection, endless scaling. */

import { dayNumber } from '../../_lq/rng';
import { GEM_IDS, gemIdFromIndex, type GemId } from '../premiumGems';
import { LEVEL_COUNT, type LevelSpec, type ModifierKind } from './levelGen';

export type SessionMode = 'classic' | 'daily' | 'endless';

const GEM_STORE_PREFIX = 'goplay.tubesort.gems.';

export function dailyChallengeSeed(gameId: string): number {
  const day = dayNumber();
  let h = 0;
  for (let i = 0; i < gameId.length; i++) h = (Math.imul(31, h) + gameId.charCodeAt(i)) | 0;
  return ((day * 2654435761) ^ h) >>> 0;
}

export function sessionSeed(mode: SessionMode, gameId: string): number {
  if (mode === 'daily') return dailyChallengeSeed(gameId);
  return Math.floor(Math.random() * 1e9);
}

/** Endless ramps past level 8 — cycles modifiers, adds colors/shuffle. */
export function endlessLevelSpec(levelIdx: number): LevelSpec {
  const cycle = levelIdx % LEVEL_COUNT;
  const tier = Math.floor(levelIdx / LEVEL_COUNT);
  const base: LevelSpec[] = [
    { colors: 3, shuffle: 10, parMoves: 14, modifiers: [] },
    { colors: 4, shuffle: 16, parMoves: 18, modifiers: [] },
    { colors: 4, shuffle: 22, parMoves: 22, modifiers: [] },
    { colors: 5, shuffle: 28, parMoves: 28, modifiers: ['hidden'] },
    { colors: 5, shuffle: 34, parMoves: 32, modifiers: ['locked'] },
    { colors: 6, shuffle: 40, parMoves: 36, modifiers: ['narrow'] },
    { colors: 6, shuffle: 46, parMoves: 40, modifiers: ['singleBuffer'] },
    { colors: 7, shuffle: 54, parMoves: 46, modifiers: ['hidden', 'locked'] },
  ];
  const src = base[cycle];
  const extraColors = Math.min(1, tier);
  const mods: ModifierKind[] = tier >= 2 && !src.modifiers.includes('locked')
    ? [...src.modifiers, 'locked']
    : [...src.modifiers];
  return {
    colors: Math.min(8, src.colors + extraColors),
    shuffle: src.shuffle + tier * 10,
    parMoves: src.parMoves + tier * 8,
    modifiers: mods,
  };
}

export function isEndlessLevel(levelIdx: number, mode: SessionMode): boolean {
  return mode === 'endless' && levelIdx >= LEVEL_COUNT;
}

export function roundLabel(levelIdx: number, mode: SessionMode): string {
  if (mode === 'endless' && levelIdx >= LEVEL_COUNT) {
    return `∞ ${levelIdx + 1}`;
  }
  if (mode === 'daily') {
    return `${levelIdx + 1}/${LEVEL_COUNT} ☀`;
  }
  return `${levelIdx + 1}/${LEVEL_COUNT}`;
}

export function collectedGems(gameId: string): GemId[] {
  try {
    const raw = localStorage.getItem(GEM_STORE_PREFIX + gameId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((g): g is GemId => GEM_IDS.includes(g as GemId));
  } catch {
    return [];
  }
}

export function recordGemCollect(gameId: string, colorId: number): GemId {
  const gem = gemIdFromIndex(colorId - 1);
  try {
    const set = new Set(collectedGems(gameId));
    set.add(gem);
    localStorage.setItem(GEM_STORE_PREFIX + gameId, JSON.stringify([...set]));
  } catch { /* storage unavailable */ }
  return gem;
}

export function gemCatalogProgress(gameId: string): { collected: number; total: number } {
  const collected = collectedGems(gameId).length;
  return { collected, total: GEM_IDS.length };
}
