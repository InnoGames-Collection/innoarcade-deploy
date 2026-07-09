import { drawGemArcStroke } from '../_shared/premiumCanvas';
import {
  CX, H, PILLAR_W, RING_COLORS, RING_R, RING_STROKE, THEME, W,
} from './constants';
import { drawSquashBall } from './effects';
import type { BallState, GameState, Ring } from './types';
import type { Juice } from '../../engine/juice';

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, THEME.bgTop);
  g.addColorStop(0.45, THEME.bgMid);
  g.addColorStop(1, THEME.bgBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(CX, H * 0.2, 0, CX, H * 0.35, W * 0.55);
  glow.addColorStop(0, 'rgba(46,204,113,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

export function drawPillar(ctx: CanvasRenderingContext2D, camY: number): void {
  const top = -camY - 80;
  const height = H + camY + 200;
  ctx.save();
  ctx.fillStyle = THEME.pillar;
  ctx.fillRect(CX - PILLAR_W / 2, top, PILLAR_W, height);
  const pg = ctx.createLinearGradient(CX - PILLAR_W / 2, 0, CX + PILLAR_W / 2, 0);
  pg.addColorStop(0, 'rgba(255,255,255,0.05)');
  pg.addColorStop(0.5, THEME.pillarGlow);
  pg.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.fillStyle = pg;
  ctx.fillRect(CX - PILLAR_W / 2, top, PILLAR_W, height);
  ctx.restore();
}

export function drawRing(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  screenY: number,
  towerAngle: number,
  gapArc: number,
): void {
  if (ring.broken) {
    if (ring.breakAnim < 1) {
      ctx.save();
      ctx.translate(CX, screenY);
      ctx.rotate(towerAngle);
      ctx.globalAlpha = 1 - ring.breakAnim;
      const spread = ring.breakAnim * 0.4;
      drawGemArcStroke(
        ctx, 0, 0, RING_R + spread * 20,
        ring.gapStart + gapArc,
        ring.gapStart + Math.PI * 2 - gapArc * 0.35,
        ring.danger ? THEME.danger : RING_COLORS[Math.max(0, ring.colorIndex)] ?? THEME.safe,
        RING_STROKE * (1 - ring.breakAnim * 0.5),
      );
      ctx.restore();
    }
    return;
  }

  const color = ring.danger
    ? THEME.danger
    : RING_COLORS[Math.max(0, ring.colorIndex)] ?? THEME.safe;

  ctx.save();
  ctx.translate(CX, screenY);
  ctx.rotate(towerAngle);
  drawGemArcStroke(
    ctx, 0, 0, RING_R,
    ring.gapStart + gapArc,
    ring.gapStart + Math.PI * 2 - gapArc * 0.35,
    color,
    RING_STROKE,
  );
  if (ring.danger) {
    ctx.strokeStyle = THEME.dangerDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, RING_R - 8, ring.gapStart + gapArc + 0.2, ring.gapStart + Math.PI - 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  combo: number,
  feverLeft: number,
  multiplier: number,
): void {
  if (state !== 'playing') return;

  ctx.textAlign = 'center';
  ctx.font = '600 14px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('Drag to rotate · Tap to spin', CX, H - 20);

  if (combo > 1) {
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = feverLeft > 0 ? THEME.fever : THEME.accent;
    const label = feverLeft > 0 ? `FEVER x${multiplier}` : `Combo x${combo}`;
    ctx.fillText(label, CX, 42);
  }
}

export function drawJuiceLayer(
  ctx: CanvasRenderingContext2D,
  juice: Juice,
  ball: BallState,
  ballColor: string,
  fever: boolean,
  camY: number,
  trail: { draw: (c: CanvasRenderingContext2D, col: string) => void },
): void {
  const by = ball.y - camY;
  trail.draw(ctx, ballColor);
  drawSquashBall(ctx, CX, by, 13, ball.squash, ballColor, fever);
  juice.drawParticles(ctx);
  juice.drawFlash(ctx, W, H);
}
