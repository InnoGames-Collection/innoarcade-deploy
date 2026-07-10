import { BALL_R, BOUNCE_VEL, GRAVITY_BASE, RING_HEIGHT } from './constants';
import type { BallState, CollisionHit, Ring } from './types';

const BOUNCE_RESTITUTION = 0.62;
const GAP_TOLERANCE = 0.06;
const PLATFORM_TOP = RING_HEIGHT * 0.5;

function normalizeAngle(a: number): number {
  let r = a;
  while (r < 0) r += Math.PI * 2;
  while (r >= Math.PI * 2) r -= Math.PI * 2;
  return r;
}

/** Ball is fixed south of helix axis (-Z). Tower rotates around axis origin. */
export function ballAngle(towerAngle: number): number {
  return normalizeAngle(towerAngle - Math.PI / 2);
}

/** Gap spans gapStart → gapStart + gapArc (matches platform geometry). */
function inGap(ballAng: number, gapStart: number, gapArc: number): boolean {
  const rel = normalizeAngle(ballAng - gapStart);
  return rel < gapArc + GAP_TOLERANCE;
}

export function gravityForDepth(passed: number, fallMul: number): number {
  return (GRAVITY_BASE + Math.min(14, passed * 0.12)) * fallMul;
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
  if (ring.danger) {
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
): CollisionHit | null {
  if (ball.vy <= 0) return null;

  let best: CollisionHit | null = null;
  let bestRingY = -Infinity;
  const hitPad = BALL_R + PLATFORM_TOP;

  for (const ring of rings) {
    if (ring.broken) continue;
    const ringY = ring.y;

    // Ring must be at or below previous position and reachable this step.
    if (ringY > ball.y + hitPad * 0.5) continue;
    if (ringY < prevY - hitPad) continue;

    const crossed = prevY <= ringY + PLATFORM_TOP && ball.y >= ringY - PLATFORM_TOP;
    if (!crossed) continue;

    const hit = evaluateRing(ball, ring, towerAngle, gapArc, feverActive);
    if (!hit) continue;

    // Nearest ring below the ball (highest ringY still under the ball).
    if (ringY > bestRingY) {
      bestRingY = ringY;
      best = hit;
    }
  }

  return best;
}

export function applyBounce(ball: BallState, impactSpeed: number): void {
  const speed = Math.max(Math.abs(impactSpeed), BOUNCE_VEL);
  ball.vy = -speed * BOUNCE_RESTITUTION;
  ball.squash = 0.6;
  ball.squashVel = -3.2;
}

/** Resting Y on top of a platform (gameplay Y grows downward). */
export function restYOnPlatform(ringY: number): number {
  return ringY - BALL_R - PLATFORM_TOP;
}

export function applyFallBoost(ball: BallState, combo: number): void {
  const boost = 1.2 + Math.min(combo, 8) * 0.55;
  if (ball.vy > 0) ball.vy += boost;
}

export function substepCount(vy: number, dt: number): number {
  return Math.max(1, Math.min(10, Math.ceil(Math.abs(vy) * dt / 0.25)));
}

export { normalizeAngle };
