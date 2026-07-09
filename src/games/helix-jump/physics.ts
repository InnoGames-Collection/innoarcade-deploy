import { BALL_R, BOUNCE_VEL, GRAVITY_BASE } from './constants';
import type { BallState, CollisionHit, Ring } from './types';

function normalizeAngle(a: number): number {
  let r = a;
  while (r < 0) r += Math.PI * 2;
  while (r >= Math.PI * 2) r -= Math.PI * 2;
  return r;
}

function ballAngle(towerAngle: number): number {
  return normalizeAngle(-Math.PI / 2 - towerAngle);
}

function inGap(rel: number, gapArc: number): boolean {
  return rel < gapArc || rel > Math.PI * 2 - gapArc * 0.35;
}

export function gravityForDepth(passed: number): number {
  return GRAVITY_BASE + Math.min(280, passed * 2.2);
}

export function integrateBall(ball: BallState, gravity: number, dt: number): void {
  ball.vy += gravity * dt;
  ball.y += ball.vy * dt;
  ball.squash += (1 - ball.squash) * Math.min(1, dt * 14);
}

export function checkRingCollision(
  ball: BallState,
  ring: Ring,
  towerAngle: number,
  camY: number,
  gapArc: number,
  feverActive: boolean,
): CollisionHit | null {
  if (ring.broken) return null;
  const screenY = ring.y - camY;
  const ballScreenY = ball.y - camY;
  if (Math.abs(screenY - ballScreenY) > BALL_R + 14) return null;
  if (ball.vy <= 0) return null;

  const ang = ballAngle(towerAngle);
  const rel = normalizeAngle(ang - ring.gapStart);
  const passedGap = inGap(rel, gapArc);

  if (passedGap) {
    return { ring, screenY, passedGap: true, bounced: false, smashed: false, died: false };
  }

  if (ring.danger) {
    return { ring, screenY, passedGap: false, bounced: false, smashed: false, died: true };
  }

  if (ring.colorIndex >= 0 && ring.colorIndex !== ball.colorIndex) {
    return { ring, screenY, passedGap: false, bounced: false, smashed: false, died: true };
  }

  if (feverActive && ring.colorIndex === ball.colorIndex) {
    return { ring, screenY, passedGap: false, bounced: false, smashed: true, died: false };
  }

  return { ring, screenY, passedGap: false, bounced: true, smashed: false, died: false };
}

export function applyBounce(ball: BallState): void {
  ball.vy = BOUNCE_VEL;
  ball.squash = 0.72;
}

export function substepCount(vy: number, dt: number): number {
  return Math.max(1, Math.min(4, Math.ceil(Math.abs(vy) * dt / 18)));
}

export { ballAngle, normalizeAngle };
