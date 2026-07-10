import { COMBO_CAP } from './constants';

/** Points for passing through a gap (combo-scaled, depth-scaled). */
export function gapPassPoints(depth: number, combo: number, perfect: boolean): number {
  const tier = 8 + Math.min(depth, 120) * 0.4;
  const mult = Math.max(1, Math.min(COMBO_CAP, combo));
  let pts = Math.round(tier * mult);
  if (perfect) pts += Math.round(tier * 0.8);
  return pts;
}

/** Small bonus each time the tower descends a level. */
export function depthMilestonePoints(depth: number): number {
  if (depth <= 0) return 0;
  return 5 + Math.floor(depth * 0.6);
}

export function smashPoints(multiplier: number, feverHit: boolean): number {
  return (feverHit ? 28 : 16) + multiplier * 5;
}

/** Simulation speed multiplier — ramps from calm start to brisk late game. */
export function simSpeedForDepth(depth: number): number {
  const t = Math.min(1, depth / 70);
  return 0.74 + t * 0.38;
}

/** Gravity scale — gentle early, faster falls later. */
export function gravityScaleForDepth(depth: number): number {
  const t = Math.min(1, depth / 90);
  return 1 + t * 0.35;
}
