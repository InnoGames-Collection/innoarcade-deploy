/**
 * Helix Jump — single source of truth for tower / ball / gap alignment.
 *
 * Convention (top-down, +Y up):
 * - Ring mesh angles use XZ: x = cos(a), z = sin(a).  a = π/2 is toward the camera (+Z).
 * - The ball is fixed in world space at BALL_CONTACT_ANGLE (π/2).
 * - The helix group rotates with rotation.y = -towerAngle.
 * - A ring-local point at angle φ therefore appears at world angle φ + towerAngle.
 * - Ring-local angle under the ball: φ_ball = π/2 - towerAngle.
 */

import {
  BALL_CONTACT_ANGLE, BALL_CONTACT_R, BALL_R,
  DANGER_TOLERANCE, GAP_PASS_TOLERANCE, SOLID_EDGE_INSET,
} from './constants';

const TAU = Math.PI * 2;

/** Angular half-width of the ball on the platform rim. */
export const BALL_HALF_ARC = Math.asin(Math.min(0.99, BALL_R / BALL_CONTACT_R));

export function normalizeAngle(a: number): number {
  let r = a;
  while (r < 0) r += TAU;
  while (r >= TAU) r -= TAU;
  return r;
}

/** Ring-local angle directly under the fixed ball for a given tower rotation. */
export function ballRingAngle(towerAngle: number): number {
  return normalizeAngle(BALL_CONTACT_ANGLE - towerAngle);
}

/** Offset from gapStart: 0 = gap leading edge, gapArc = solid lip. */
export function gapOffset(ballAng: number, gapStart: number): number {
  return normalizeAngle(ballAng - gapStart);
}

/**
 * Ball center is over the empty hole [gapStart, gapStart + gapArc).
 * Solid wedge mesh begins at gapStart + gapArc.
 * Only the solid-side lip is inset — centered alignment always passes.
 */
export function ballOverGap(
  towerAngle: number,
  gapStart: number,
  gapArc: number,
  tol = GAP_PASS_TOLERANCE,
): boolean {
  const rel = gapOffset(ballRingAngle(towerAngle), gapStart);
  return rel < gapArc - SOLID_EDGE_INSET - tol;
}

export function ballOverDanger(
  towerAngle: number,
  dangerStart: number,
  dangerArc: number,
): boolean {
  if (dangerArc <= 0) return false;
  const rel = gapOffset(ballRingAngle(towerAngle), dangerStart);
  return rel < dangerArc + DANGER_TOLERANCE;
}

export function ballOnSolidWedge(
  towerAngle: number,
  gapStart: number,
  gapArc: number,
): boolean {
  const rel = gapOffset(ballRingAngle(towerAngle), gapStart);
  return rel >= gapArc - SOLID_EDGE_INSET;
}

export function gapCenterOffset(towerAngle: number, gapStart: number, gapArc: number): number {
  const rel = gapOffset(ballRingAngle(towerAngle), gapStart);
  return Math.abs(rel - gapArc * 0.5);
}
