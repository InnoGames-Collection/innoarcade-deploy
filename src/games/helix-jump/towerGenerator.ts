import {
  DANGER_ARC_MAX, DANGER_ARC_MIN, DANGER_TOLERANCE, GAP_ARC, RING_COLORS, RING_SPACING_BASE,
} from './constants';
import { normalizeAngle } from './coords';
import { progressionForDepth } from './scoring';
import type { Ring } from './types';

export interface TowerConfig {
  depth: number;
  gapArc: number;
  spacing: number;
  dangerChance: number;
}

const MIN_GAP = 0.78;
const MIN_SOLID = 0.7;
const TAU = Math.PI * 2;
const MOVE_FREQ = 1.8;
const SOLID_UNDER_MARGIN = 0.4;

export function towerConfigForDepth(passed: number): TowerConfig {
  const t = Math.min(1, passed / 75);
  return {
    depth: passed,
    gapArc: Math.max(MIN_GAP, GAP_ARC - t * 0.3),
    spacing: Math.max(1.78, RING_SPACING_BASE - t * 0.4),
    dangerChance: progressionForDepth(passed).dangerChance,
  };
}

let nextRingId = 1;

function gapIsFair(gapArc: number): boolean {
  const solidArc = TAU - gapArc;
  return solidArc >= MIN_SOLID && gapArc >= MIN_GAP;
}

function ballOnSolid(ballShapeAng: number, gapStart: number, gapArc: number, margin = SOLID_UNDER_MARGIN): boolean {
  const rel = normalizeAngle(ballShapeAng - gapStart);
  return rel >= gapArc + margin;
}

function placeGapStart(
  ringGap: number,
  rnd: () => number,
  prev: Ring | undefined,
  solidUnderBall?: number,
): number {
  for (let attempt = 0; attempt < 20; attempt++) {
    let gapStart = rnd() * TAU;

    if (prev && !ringHasDanger(prev)) {
      const minSep = ringGap * 0.85;
      let sep = Math.abs(gapStart - prev.gapStart);
      if (sep > Math.PI) sep = TAU - sep;
      if (sep < minSep) {
        gapStart = normalizeAngle(prev.gapStart + minSep + 0.25 + rnd() * 0.5);
      }
    }

    if (solidUnderBall !== undefined && !ballOnSolid(solidUnderBall, gapStart, ringGap)) {
      continue;
    }

    if (gapIsFair(ringGap)) return gapStart;
  }

  if (solidUnderBall !== undefined) {
    return normalizeAngle(solidUnderBall - ringGap - SOLID_UNDER_MARGIN - 0.6);
  }
  return rnd() * TAU;
}

function placeDanger(
  gapStart: number,
  ringGap: number,
  dangerArc: number,
  rnd: () => number,
  avoidBallAngle?: number,
): number {
  const solidArc = TAU - ringGap;
  const margin = 0.16;
  const placeArc = Math.max(0.3, solidArc - dangerArc - margin * 2);

  for (let attempt = 0; attempt < 12; attempt++) {
    const dangerStart = normalizeAngle(gapStart + ringGap + margin + rnd() * placeArc);
    if (avoidBallAngle === undefined) return dangerStart;

    const rel = normalizeAngle(avoidBallAngle - dangerStart);
    if (rel > dangerArc + DANGER_TOLERANCE + 0.12) return dangerStart;
  }

  return normalizeAngle(gapStart + ringGap + margin + placeArc * 0.5);
}

export function ringHasDanger(ring: Ring): boolean {
  return ring.dangerArc > 0;
}

export function ringWorldY(ring: Ring, time: number): number {
  if (ring.moveAmp <= 0) return ring.y;
  return ring.y + Math.sin(time * MOVE_FREQ + ring.movePhase) * ring.moveAmp;
}

function pickGapArc(cfg: TowerConfig, rnd: () => number, depth: number): number {
  const prog = progressionForDepth(depth);
  if (rnd() < prog.narrowGapChance) {
    return Math.max(MIN_GAP, cfg.gapArc * (0.86 + rnd() * 0.08));
  }
  if (depth < 5) return cfg.gapArc;
  const roll = rnd();
  if (roll < 0.18) return Math.max(MIN_GAP, cfg.gapArc * 0.9);
  if (roll > 0.84) return Math.min(TAU - MIN_SOLID, cfg.gapArc * 1.05);
  return cfg.gapArc;
}

export function createRing(
  y: number,
  rnd: () => number,
  cfg: TowerConfig,
  prev?: Ring,
  solidUnderBall?: number,
): Ring {
  const depth = cfg.depth;
  const prog = progressionForDepth(depth);
  const ringGap = pickGapArc(cfg, rnd, depth);
  const gapStart = placeGapStart(ringGap, rnd, prev, solidUnderBall);

  const layer = Math.max(0, Math.floor(y / cfg.spacing));
  const forceDanger = layer >= 1 && (layer % 3 === 0 || layer % 5 === 0);
  let hasDanger = layer >= 1 && (forceDanger || rnd() < prog.dangerChance);
  if (prev && ringHasDanger(prev)) hasDanger = forceDanger || rnd() < prog.dangerChance * 0.4;

  let dangerStart = 0;
  let dangerArc = 0;
  if (hasDanger) {
    dangerArc = DANGER_ARC_MIN + rnd() * (DANGER_ARC_MAX - DANGER_ARC_MIN);
    dangerStart = placeDanger(gapStart, ringGap, dangerArc, rnd, solidUnderBall);
  }

  let moveAmp = 0;
  let movePhase = 0;
  if (depth > 2 && rnd() < prog.moveChance) {
    moveAmp = 0.1 + rnd() * (0.1 + depth * 0.005);
    movePhase = rnd() * TAU;
  }

  let spinVel = 0;
  if (depth > 12 && rnd() < 0.05 + depth * 0.004) {
    spinVel = (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.4);
  }

  const colorIndex = (depth + nextRingId) % RING_COLORS.length;

  return {
    id: nextRingId++,
    y,
    gapStart,
    gapArc: ringGap,
    colorIndex,
    dangerStart,
    dangerArc,
    moveAmp,
    movePhase,
    spinVel,
    broken: false,
    breakAnim: 0,
  };
}

export function resetRingIds(): void {
  nextRingId = 1;
}

export { MOVE_FREQ };
