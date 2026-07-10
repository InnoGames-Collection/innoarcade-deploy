import { COMBO_CAP, FALL_TERMINAL_VY } from './constants';

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

export interface DepthProgression {
  simSpeed: number;
  gravity: number;
  fallCap: number;
  dangerChance: number;
  moveChance: number;
  narrowGapChance: number;
}

/** All depth-based difficulty knobs in one place. */
export function progressionForDepth(depth: number): DepthProgression {
  const t = Math.min(1, depth / 55);
  const late = Math.min(1, Math.max(0, depth - 25) / 45);
  return {
    simSpeed: 0.72 + t * 0.48 + late * 0.12,
    gravity: 1 + t * 0.45 + late * 0.2,
    fallCap: FALL_TERMINAL_VY + t * 4 + late * 3,
    dangerChance: 0.32 + t * 0.38 + late * 0.15,
    moveChance: 0.04 + t * 0.22 + late * 0.12,
    narrowGapChance: Math.min(0.42, Math.max(0, depth - 3) * 0.012),
  };
}

/** @deprecated Use progressionForDepth().simSpeed */
export function simSpeedForDepth(depth: number): number {
  return progressionForDepth(depth).simSpeed;
}

/** @deprecated Use progressionForDepth().gravity */
export function gravityScaleForDepth(depth: number): number {
  return progressionForDepth(depth).gravity;
}
