import {
  BALL_CONTACT_ANGLE, BALL_R, BALL_ROLL_RATE, BALL_SQUASH_MAX, BALL_SQUASH_MIN,
  BALL_STRETCH_MAX, BOUNCE_RESTITUTION, BOUNCE_UP_MAX, BOUNCE_UP_VEL,
  BOUNCE_VEL, DANGER_TOLERANCE, FALL_STRETCH_SPEED, FALL_TERMINAL_VY,
  GAP_PASS_TOLERANCE, GRAVITY_BASE,
  RING_HEIGHT, SOLID_EDGE_INSET,
} from './constants';
import { easeOutBack } from './easing';
import { ringWorldY } from './towerGenerator';
import type { BallState, CollisionHit, LandingFx, Ring } from './types';

const PLATFORM_TOP = RING_HEIGHT * 0.5;
const SUBSTEP_DIST = 0.16;

function normalizeAngle(a: number): number {
  let r = a;
  while (r < 0) r += Math.PI * 2;
  while (r >= Math.PI * 2) r -= Math.PI * 2;
  return r;
}

export function ballAngle(towerAngle: number): number {
  return normalizeAngle(towerAngle + BALL_CONTACT_ANGLE);
}

/** Gap tolerance — fixed small margin only (no speed cheating). */
export function gapTolerance(_vy: number): number {
  return GAP_PASS_TOLERANCE;
}

export function inGap(ballAng: number, gapStart: number, gapArc: number, tol = GAP_PASS_TOLERANCE): boolean {
  const rel = normalizeAngle(ballAng - gapStart);
  return rel < gapArc + tol;
}

export function inDangerZone(ballAng: number, dangerStart: number, dangerArc: number): boolean {
  if (dangerArc <= 0) return false;
  const rel = normalizeAngle(ballAng - dangerStart);
  return rel < dangerArc + DANGER_TOLERANCE;
}

export function onSolid(ballAng: number, gapStart: number, gapArc: number, tol = 0): boolean {
  const rel = normalizeAngle(ballAng - gapStart);
  return rel >= gapArc - SOLID_EDGE_INSET - tol;
}

/** Distance from gap center in radians (0 = centered in gap). */
function gapCenterDist(ballAng: number, gapStart: number, gapArc: number): number {
  const rel = normalizeAngle(ballAng - gapStart);
  const center = gapArc * 0.5;
  return Math.abs(rel - center);
}

export function gravityForDepth(passed: number, fallMul: number): number {
  return (GRAVITY_BASE + Math.min(2.5, passed * 0.02)) * fallMul;
}

export function integrateBall(ball: BallState, gravity: number, dt: number): void {
  ball.vy += gravity * dt;
  if (ball.vy > FALL_TERMINAL_VY) ball.vy = FALL_TERMINAL_VY;
  ball.y += ball.vy * dt;
  ball.rollAngle += ball.vy * dt * BALL_ROLL_RATE;

  const spring = 52;
  const damp = 24;
  ball.squashVel += (1 - ball.squash) * spring * dt;
  ball.squashVel -= ball.squashVel * damp * dt;
  ball.squash += ball.squashVel * dt;
  if (ball.squash > BALL_SQUASH_MAX) {
    ball.squash = BALL_SQUASH_MAX;
    ball.squashVel *= -0.28;
  }
  if (ball.squash < BALL_SQUASH_MIN) ball.squash = BALL_SQUASH_MIN;

  if (ball.squash > 0.94) {
    const t = Math.min(1, Math.abs(ball.vy) / FALL_STRETCH_SPEED);
    ball.stretch = t * BALL_STRETCH_MAX;
  } else {
    ball.stretch *= Math.exp(-dt * 18);
  }
}

interface RingCandidate {
  ring: Ring;
  ringY: number;
  surfaceY: number;
}

function collectCandidates(
  ball: BallState,
  prevY: number,
  rings: Ring[],
  time: number,
  clearedIds?: ReadonlySet<number>,
): RingCandidate[] {
  const hitPad = BALL_R + PLATFORM_TOP;
  const out: RingCandidate[] = [];

  for (const ring of rings) {
    if (ring.broken) continue;
    if (clearedIds?.has(ring.id)) continue;

    const ringY = ringWorldY(ring, time);
    if (ringY > ball.y + hitPad * 0.35) continue;
    if (ringY < prevY - hitPad * 1.2) continue;

    const surfaceY = ringY - BALL_R - PLATFORM_TOP;
    const crossed = prevY <= ringY + PLATFORM_TOP * 0.5 && ball.y >= ringY - PLATFORM_TOP;
    const landing = ball.vy > 0.25 && ball.y >= surfaceY - 0.06 && prevY <= surfaceY + 0.14;
    if (!crossed && !landing) continue;

    out.push({ ring, ringY, surfaceY });
  }

  out.sort((a, b) => b.ringY - a.ringY);
  return out;
}

function evaluateRingCrossing(
  ball: BallState,
  prevY: number,
  cand: RingCandidate,
  towerAngle: number,
  feverActive: boolean,
): CollisionHit | null {
  const { ring, ringY, surfaceY } = cand;
  const ang = ballAngle(towerAngle);
  const tol = gapTolerance(ball.vy);
  const impactSpeed = Math.abs(ball.vy);

  const passedGap = inGap(ang, ring.gapStart, ring.gapArc, tol);
  const solid = onSolid(ang, ring.gapStart, ring.gapArc, tol);
  const gapDist = gapCenterDist(ang, ring.gapStart, ring.gapArc);
  const nearGapCenter = passedGap && gapDist < ring.gapArc * 0.22;

  const perfect = passedGap && nearGapCenter && Math.abs(ball.y - ringY) < 0.05 && ball.vy > 1.8;

  // Only pass when the ball is actually over the gap opening.
  if (passedGap) {
    return {
      ring, screenY: ringY - ball.y, passedGap: true, bounced: false,
      smashed: false, died: false, perfect, impactSpeed,
    };
  }

  if (!solid) {
    return null;
  }

  // Must be crossing the top surface plane (not side-grazing).
  const planeCross = prevY <= surfaceY + 0.08 && ball.y >= surfaceY - 0.03;
  if (!planeCross && ball.vy > 2) return null;

  if (inDangerZone(ang, ring.dangerStart, ring.dangerArc)) {
    return {
      ring, screenY: ringY - ball.y, passedGap: false, bounced: false,
      smashed: false, died: true, perfect: false, impactSpeed,
    };
  }

  if (feverActive) {
    return {
      ring, screenY: ringY - ball.y, passedGap: false, bounced: false,
      smashed: true, died: false, perfect, impactSpeed,
    };
  }

  return {
    ring, screenY: ringY - ball.y, passedGap: false, bounced: true,
    smashed: false, died: false, perfect: false, impactSpeed,
  };
}

/** Smart collision — one ring at a time, swept plane crossing, velocity-aware gap. */
export function findSweepCollision(
  ball: BallState,
  prevY: number,
  rings: Ring[],
  towerAngle: number,
  feverActive: boolean,
  time: number,
  clearedIds?: ReadonlySet<number>,
): CollisionHit | null {
  if (ball.vy <= 0) return null;

  const candidates = collectCandidates(ball, prevY, rings, time, clearedIds);
  for (const cand of candidates) {
    const hit = evaluateRingCrossing(ball, prevY, cand, towerAngle, feverActive);
    if (hit) return hit;
  }
  return null;
}

/** Next ring the ball is falling toward (for approach highlight). */
export function findApproachRing(
  ball: BallState,
  rings: Ring[],
  time: number,
  clearedIds?: ReadonlySet<number>,
): Ring | null {
  if (ball.vy <= 0.5) return null;

  let best: Ring | null = null;
  let bestDy = Infinity;

  for (const ring of rings) {
    if (ring.broken) continue;
    if (clearedIds?.has(ring.id)) continue;
    const ringY = ringWorldY(ring, time);
    const dy = ringY - ball.y;
    if (dy <= 0.2 || dy > RING_HEIGHT + BALL_R + 2.8) continue;
    if (dy < bestDy) {
      bestDy = dy;
      best = ring;
    }
  }
  return best;
}

export function approachZone(
  ring: Ring,
  towerAngle: number,
): 'gap' | 'safe' | 'danger' | 'none' {
  const ang = ballAngle(towerAngle);
  const tol = gapTolerance(8);
  if (inGap(ang, ring.gapStart, ring.gapArc, tol)) return 'gap';
  if (inDangerZone(ang, ring.dangerStart, ring.dangerArc)) return 'danger';
  if (onSolid(ang, ring.gapStart, ring.gapArc)) return 'safe';
  return 'none';
}

export function applyBounce(ball: BallState, impactSpeed: number): number {
  const impact = Math.abs(impactSpeed);
  let upVel = BOUNCE_UP_VEL;
  if (impact > BOUNCE_VEL) {
    upVel = Math.min(
      BOUNCE_UP_MAX,
      BOUNCE_UP_VEL + (impact - BOUNCE_VEL) * BOUNCE_RESTITUTION,
    );
  }
  ball.vy = -upVel;
  ball.stretch = 0;
  return impact;
}

export function landingFx(impactSpeed: number): LandingFx {
  const impact = Math.abs(impactSpeed);
  const t = Math.min(1, impact / 20);
  return {
    shake: 0.01 + t * 0.02,
    particleCount: 4 + Math.floor(t * 5),
    spread: 1.6 + t * 1.4,
    squash: 0.82 - t * 0.04,
    squashVel: -2.0 - t * 0.8,
  };
}

export function applyLandingFx(ball: BallState, fx: LandingFx): void {
  ball.squash = fx.squash;
  ball.squashVel = fx.squashVel;
}

export function restYOnPlatform(ringY: number): number {
  return ringY - BALL_R - PLATFORM_TOP;
}

export function clearYThroughRing(ringY: number): number {
  return ringY + PLATFORM_TOP + BALL_R * 0.15;
}

export function applyFallBoost(_ball: BallState, _combo: number): void {
  // Disabled — fall speed stays controllable; combos should not accelerate the drop.
}

export function breakAnimScale(t: number): number {
  return 1 - easeOutBack(Math.min(1, t)) * 0.88;
}

export function substepCount(vy: number, dt: number): number {
  return Math.max(1, Math.min(12, Math.ceil(Math.abs(vy) * dt / SUBSTEP_DIST)));
}

export { normalizeAngle };
