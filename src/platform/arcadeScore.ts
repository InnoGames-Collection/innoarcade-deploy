/** Shared scoring for arcade / canvas free games. */

export const ARCADE_SCORE_MULT = 10;

/** Scale raw in-game counters (matches, hits, etc.) for display and submit. */
export function scaleArcadeScore(raw: number, mult = ARCADE_SCORE_MULT): number {
  return Math.max(0, Math.round(raw * mult));
}

/** Final run score: scaled base + time-left bonus. */
export function finalizeArcadeScore(
  rawScore: number,
  durationMs: number,
  opts?: { mult?: number; budgetSec?: number; timeWeight?: number },
): number {
  const mult = opts?.mult ?? ARCADE_SCORE_MULT;
  const budget = opts?.budgetSec ?? 120;
  const timeWeight = opts?.timeWeight ?? 2;
  const timeSec = Math.floor(durationMs / 1000);
  const timeBonus = Math.max(0, budget - timeSec) * timeWeight;
  return scaleArcadeScore(rawScore, mult) + timeBonus;
}

/** Match-3 style: points per cleared tile with combo tiers. */
export function match3Score(cleared: number, combo: number, pointsPerTile = 15): number {
  const tier = 1 + Math.max(0, combo - 1) * 0.35;
  return Math.round(cleared * pointsPerTile * tier);
}
