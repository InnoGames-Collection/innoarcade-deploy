import { DANGER_ARC_MAX, DANGER_ARC_MIN, GAP_ARC, RING_COLORS, RING_SPACING_BASE } from './constants';
import type { Ring } from './types';

export interface TowerConfig {
  depth: number;
  gapArc: number;
  spacing: number;
  dangerChance: number;
}

const MIN_GAP = 0.82;
const MIN_SOLID = 0.65;
const TAU = Math.PI * 2;

export function towerConfigForDepth(passed: number): TowerConfig {
  const t = Math.min(1, passed / 160);
  return {
    depth: passed,
    gapArc: Math.max(MIN_GAP, GAP_ARC - t * 0.24),
    spacing: Math.max(2.1, RING_SPACING_BASE - t * 0.45),
    dangerChance: 0.08 + t * 0.14,
  };
}

let nextRingId = 1;

function gapIsFair(gapArc: number): boolean {
  const solidArc = TAU - gapArc;
  return solidArc >= MIN_SOLID && gapArc >= MIN_GAP;
}

function normalizeAngle(a: number): number {
  let r = a;
  while (r < 0) r += TAU;
  while (r >= TAU) r -= TAU;
  return r;
}

export function ringHasDanger(ring: Ring): boolean {
  return ring.dangerArc > 0;
}

export function createRing(
  y: number,
  rnd: () => number,
  cfg: TowerConfig,
  prev?: Ring,
): Ring {
  let hasDanger = rnd() < cfg.dangerChance;
  if (prev && ringHasDanger(prev)) hasDanger = rnd() < cfg.dangerChance * 0.22;

  let gapStart = rnd() * TAU;
  for (let i = 0; i < 8 && !gapIsFair(cfg.gapArc); i++) {
    gapStart = rnd() * TAU;
  }

  if (prev && !ringHasDanger(prev)) {
    const minSep = cfg.gapArc * 0.9;
    let sep = Math.abs(gapStart - prev.gapStart);
    if (sep > Math.PI) sep = TAU - sep;
    if (sep < minSep) {
      gapStart = (prev.gapStart + minSep + 0.35) % TAU;
    }
  }

  const solidArc = TAU - cfg.gapArc;
  let dangerStart = 0;
  let dangerArc = 0;
  if (hasDanger) {
    dangerArc = DANGER_ARC_MIN + rnd() * (DANGER_ARC_MAX - DANGER_ARC_MIN);
    const margin = 0.18;
    const placeArc = Math.max(0.35, solidArc - dangerArc - margin * 2);
    dangerStart = normalizeAngle(
      gapStart + cfg.gapArc + margin + rnd() * placeArc,
    );
  }

  const colorIndex = (Math.floor(rnd() * RING_COLORS.length) + cfg.depth) % RING_COLORS.length;

  return {
    id: nextRingId++,
    y,
    gapStart,
    colorIndex,
    dangerStart,
    dangerArc,
    broken: false,
    breakAnim: 0,
  };
}

export function resetRingIds(): void {
  nextRingId = 1;
}
