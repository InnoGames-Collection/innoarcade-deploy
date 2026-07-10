import {
  BALL_CONTACT_ANGLE, BALL_R, BOUNCE_RESTITUTION, BOUNCE_UP_MAX, BOUNCE_UP_VEL,
  BOUNCE_VEL, DANGER_TOLERANCE, GAP_PASS_TOLERANCE, GRAVITY_BASE, RING_HEIGHT,
  SOLID_EDGE_INSET,
} from './constants';
import type { BallState, CollisionHit, Ring } from './types';

const PLATFORM_TOP = RING_HEIGHT * 0.5;
/** Substep distance — smaller = more accurate collision at high fall speed. */
const SUBSTEP_DIST = 0.18;

function normalizeAngle(a: number): number {
  let r = a;
  while (r < 0) r += Math.PI * 2;
  while (r >= Math.PI * 2) r -= Math.PI * 2;
  return r;
}

/** Ball is fixed at BALL_CONTACT_ANGLE from helix axis. Tower rotates around axis origin. */
export function ballAngle(towerAngle: number): number {
  return normalizeAngle(towerAngle + BALL_CONTACT_ANGLE);
}

/** Gap spans gapStart → gapStart + gapArc (matches platform geometry exactly). */
export function inGap(ballAng: number, gapStart: number, gapArc: number): boolean {
  const rel = normalizeAngle(ballAng - gapStart);
  return rel < gapArc + GAP_PASS_TOLERANCE;
}

/** Hazard wedge on solid platform (reference: orange segment only). */
export function inDangerZone(ballAng: number, dangerStart: number, dangerArc: number): boolean {
  if (dangerArc <= 0) return false;
  const rel = normalizeAngle(ballAng - dangerStart);
  return rel < dangerArc + DANGER_TOLERANCE;
}

/** Solid segment — requires clear contact past gap edge to avoid false bounces. */
export function onSolid(ballAng: number, gapStart: number, gapArc: number): boolean {
  const rel = normalizeAngle(ballAng - gapStart);
  return rel >= gapArc - SOLID_EDGE_INSET;
}

export function gravityForDepth(passed: number, fallMul: number): number {
  return (GRAVITY_BASE + Math.min(12, passed * 0.1)) * fallMul;
}

export function integrateBall(ball: BallState, gravity: number, dt: number): void {
  ball.vy += gravity * dt;
  ball.y += ball.vy * dt;

  const spring = 42;
  const damp = 18;
  ball.squashVel += (1 - ball.squash) * spring * dt;
  ball.squashVel -= ball.squashVel * damp * dt;
  ball.squash += ball.squashVel * dt;
  if (ball.squash > 1.12) {
    ball.squash = 1.12;
    ball.squashVel *= -0.32;
  }
  if (ball.squash < 0.58) ball.squash = 0.58;
}

function evaluateRing(
  ball: BallState,
  ring: Ring,
  towerAngle: number,
  gapArc: number,
  feverActive: boolean,
): CollisionHit | null {
  const ang = ballAngle(towerAngle);
  const passedGap = inGap(ang, ring.gapStart, gapArc);
  const perfect = Math.abs(ball.y - ring.y) < 0.06 && ball.vy > 3;

  if (passedGap) {
    return { ring, screenY: ring.y - ball.y, passedGap: true, bounced: false, smashed: false, died: false, perfect };
  }

  if (!onSolid(ang, ring.gapStart, gapArc)) {
    return { ring, screenY: ring.y - ball.y, passedGap: true, bounced: false, smashed: false, died: false, perfect: false };
  }

  if (inDangerZone(ang, ring.dangerStart, ring.dangerArc)) {
    return { ring, screenY: ring.y - ball.y, passedGap: false, bounced: false, smashed: false, died: true, perfect: false };
  }
  if (feverActive) {
    return { ring, screenY: ring.y - ball.y, passedGap: false, bounced: false, smashed: true, died: false, perfect };
  }
  return { ring, screenY: ring.y - ball.y, passedGap: false, bounced: true, smashed: false, died: false, perfect };
}

/** Swept collision — finds the topmost ring the ball crosses while falling. */
export function findSweepCollision(
  ball: BallState,
  prevY: number,
  rings: Ring[],
  towerAngle: number,
  gapArc: number,
  feverActive: boolean,
  clearedIds?: ReadonlySet<number>,
): CollisionHit | null {
  if (ball.vy <= 0) return null;

  let best: CollisionHit | null = null;
  let bestRingY = -Infinity;
  const hitPad = BALL_R + PLATFORM_TOP;

  for (const ring of rings) {
    if (ring.broken) continue;
    if (clearedIds?.has(ring.id)) continue;

    const ringY = ring.y;

    if (ringY > ball.y + hitPad * 0.5) continue;
    if (ringY < prevY - hitPad) continue;

    const surfaceY = ringY - BALL_R - PLATFORM_TOP;
    const crossed = prevY <= ringY + PLATFORM_TOP && ball.y >= ringY - PLATFORM_TOP;
    const landing = ball.vy > 0.4 && ball.y >= surfaceY - 0.05 && prevY <= surfaceY + 0.12;
    if (!crossed && !landing) continue;

    const hit = evaluateRing(ball, ring, towerAngle, gapArc, feverActive);
    if (!hit) continue;

    if (ringY > bestRingY) {
      bestRingY = ringY;
      best = hit;
    }
  }

  return best;
}

export function applyBounce(ball: BallState, impactSpeed: number): void {
  const impact = Math.abs(impactSpeed);
  let upVel = BOUNCE_UP_VEL;
  if (impact > BOUNCE_VEL) {
    upVel = Math.min(
      BOUNCE_UP_MAX,
      BOUNCE_UP_VEL + (impact - BOUNCE_VEL) * BOUNCE_RESTITUTION,
    );
  }
  ball.vy = -upVel;
  ball.squash = 0.58;
  ball.squashVel = -3.8;
}

/** Resting Y on top of a platform (gameplay Y grows downward). */
export function restYOnPlatform(ringY: number): number {
  return ringY - BALL_R - PLATFORM_TOP;
}

/** Push ball center past a ring after gap pass — prevents re-collision same frame. */
export function clearYThroughRing(ringY: number): number {
  return ringY + PLATFORM_TOP + BALL_R * 0.1;
}

export function applyFallBoost(ball: BallState, combo: number): void {
  const boost = 1.2 + Math.min(combo, 8) * 0.55;
  if (ball.vy > 0) ball.vy += boost;
}

export function substepCount(vy: number, dt: number): number {
  return Math.max(1, Math.min(12, Math.ceil(Math.abs(vy) * dt / SUBSTEP_DIST)));
}

export { normalizeAngle };
