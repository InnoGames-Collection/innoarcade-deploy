import { GAP_ARC, RING_COLORS, RING_SPACING_BASE } from './constants';
import type { Ring } from './types';

export interface TowerConfig {
  depth: number;
  gapArc: number;
  spacing: number;
  dangerChance: number;
}

export function towerConfigForDepth(passed: number): TowerConfig {
  const t = Math.min(1, passed / 120);
  return {
    depth: passed,
    gapArc: GAP_ARC - t * 0.18,
    spacing: RING_SPACING_BASE - t * 10,
    dangerChance: 0.14 + t * 0.12,
  };
}

let nextRingId = 1;

export function createRing(y: number, rnd: () => number, cfg: TowerConfig): Ring {
  const colorIndex = (Math.floor(rnd() * RING_COLORS.length) + cfg.depth) % RING_COLORS.length;
  const danger = rnd() < cfg.dangerChance;
  return {
    id: nextRingId++,
    y,
    gapStart: rnd() * Math.PI * 2,
    colorIndex: danger ? -1 : colorIndex,
    danger,
    broken: false,
    breakAnim: 0,
  };
}

export function resetRingIds(): void {
  nextRingId = 1;
}
