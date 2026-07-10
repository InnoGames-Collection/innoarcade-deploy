import {
  BALL_CONTACT_ANGLE, BALL_R, BALL_ROLL_RATE, BALL_SQUASH_MAX, BALL_SQUASH_MIN,
  BALL_STRETCH_MAX, BOUNCE_RESTITUTION, BOUNCE_UP_MAX, BOUNCE_UP_VEL,
  BOUNCE_VEL, DANGER_TOLERANCE, FALL_STRETCH_SPEED, FALL_TERMINAL_VY,
  GAP_EDGE_INSET, GAP_PASS_TOLERANCE, GRAVITY_BASE,
  RING_HEIGHT,
} from './constants';
import { easeOutBack } from './easing';
import { ringWorldY } from './towerGenerator';
import type { BallState, CollisionHit, LandingFx, Ring } from './types';

const PLATFORM_TOP = RING_HEIGHT * 0.5;
const SUBSTEP_DIST = 0.1;

function normalizeAngle(a: number): number {
  let r = a;
  while (r < 0) r += Math.PI * 2;
  while (r >= Math.PI * 2) r -= Math.PI * 2;
  return r;
}

export function ballAngle(towerAngle: number): number {
  // Tower mesh rotates by -angle; ball is fixed in world at +Z (π/2).
  return normalizeAngle(BALL_CONTACT_ANGLE - towerAngle);
}

export function gapTolerance(_vy: number): number {
  return GAP_PASS_TOLERANCE;
}

/**
 * True only when the ball sits over the empty gap arc [gapStart, gapStart + gapArc).
 * Matches platform geometry: safe mesh starts at gapStart + gapArc.
 */
export function inGapOpening(
  ballAng: number,
  gapStart: number,
  gapArc: number,
  tol = GAP_PASS_TOLERANCE,
): boolean {
  const rel = normalizeAngle(ballAng - gapStart);
  const inset = GAP_EDGE_INSET;
  return rel > inset - tol && rel < gapArc - inset + tol;
}

/** Looser — approach highlight only. */
export function inGapLoose(ballAng: number, gapStart: number, gapArc: number): boolean {
  const rel = normalizeAngle(ballAng - gapStart);
  return rel < gapArc + GAP_PASS_TOLERANCE * 2;
}

export function inDangerZone(ballAng: number, dangerStart: number, dangerArc: number): boolean {
  if (dangerArc <= 0) return false;
  const rel = normalizeAngle(ballAng - dangerStart);
  return rel < dangerArc + DANGER_TOLERANCE;
}

/** Solid platform wedge (everything that is not the gap opening). */
export function onSolid(ballAng: number, gapStart: number, gapArc: number): boolean {
  return !inGapOpening(ballAng, gapStart, gapArc);
}

function gapCenterDist(ballAng: number, gapStart: number, gapArc: number): number {
  const rel = normalizeAngle(ballAng - gapStart);
  return Math.abs(rel - gapArc * 0.5);
}

export function gravityForDepth(passed: number, fallMul: number): number {
  return (GRAVITY_BASE + Math.min(8, passed * 0.055)) * fallMul;
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
  const out: RingCandidate[] = [];

  for (const ring of rings) {
    if (ring.broken) continue;
    if (clearedIds?.has(ring.id)) continue;

    const ringY = ringWorldY(ring, time);
    const surfaceY = ringY - BALL_R - PLATFORM_TOP;

    // Swept segment must cross the platform top plane while falling.
    if (ball.vy <= 0) continue;
    if (prevY > surfaceY + 0.12 && ball.y < surfaceY - 0.04) continue;
    if (ringY > ball.y + BALL_R + PLATFORM_TOP) continue;
    if (ringY < prevY - BALL_R - PLATFORM_TOP * 2) continue;

    const crossedSurface = prevY <= surfaceY + 0.04 && ball.y >= surfaceY - 0.02;
    if (!crossedSurface) continue;

    out.push({ ring, ringY, surfaceY });
  }

  out.sort((a, b) => b.ringY - a.ringY);
  return out;
}

function evaluateRingCrossing(
  ball: BallState,
  _prevY: number,
  cand: RingCandidate,
  towerAngle: number,
  feverActive: boolean,
): CollisionHit {
  const { ring, ringY } = cand;
  const ang = ballAngle(towerAngle);
  const impactSpeed = Math.abs(ball.vy);
  const overGap = inGapOpening(ang, ring.gapStart, ring.gapArc);
  const gapDist = gapCenterDist(ang, ring.gapStart, ring.gapArc);
  const perfect = overGap && gapDist < ring.gapArc * 0.2 && ball.vy > 3;

  // Hole under the ball → drop through. Everything else is solid.
  if (overGap) {
    return {
      ring, screenY: ringY - ball.y, passedGap: true, bounced: false,
      smashed: false, died: false, perfect, impactSpeed,
    };
  }

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

  // Solid platform — always bounce (snap to surface).
  return {
    ring, screenY: ringY - ball.y, passedGap: false, bounced: true,
    smashed: false, died: false, perfect: false, impactSpeed,
  };
}

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
    return evaluateRingCrossing(ball, prevY, cand, towerAngle, feverActive);
  }
  return null;
}

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
    if (dy <= 0.2 || dy > RING_HEIGHT + BALL_R + 2.4) continue;
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
  if (inGapLoose(ang, ring.gapStart, ring.gapArc)) return 'gap';
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
  const t = Math.min(1, impact / 18);
  return {
    shake: 0.015 + t * 0.03,
    particleCount: 5 + Math.floor(t * 6),
    spread: 1.8 + t * 1.6,
    squash: 0.8 - t * 0.05,
    squashVel: -2.2 - t * 0.9,
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
  return ringY + PLATFORM_TOP + BALL_R * 0.1;
}

export function applyFallBoost(ball: BallState, combo: number): void {
  if (ball.vy <= 0) return;
  const boost = 0.4 + Math.min(combo, 6) * 0.28;
  ball.vy = Math.min(FALL_TERMINAL_VY, ball.vy + boost);
}

export function breakAnimScale(t: number): number {
  return 1 - easeOutBack(Math.min(1, t)) * 0.88;
}

export function substepCount(vy: number, dt: number): number {
  return Math.max(1, Math.min(16, Math.ceil(Math.abs(vy) * dt / SUBSTEP_DIST)));
}

export { normalizeAngle };
