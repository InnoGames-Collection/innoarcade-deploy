// Eagle swoop VFX — anti-camping game-over animation.

import { W, type WorldSnapshot } from '../types';

const EAGLE_DUR = 0.85;

export function eagleProgress(eagleT: number): number {
  if (eagleT <= 0) return 0;
  return 1 - eagleT / EAGLE_DUR;
}

export function drawEagleSwoop(
  ctx: CanvasRenderingContext2D,
  s: WorldSnapshot,
  targetX: number,
  targetY: number,
): void {
  if (s.eagleT <= 0) return;

  const p = eagleProgress(s.eagleT);
  const ease = p * p * (3 - 2 * p);
  const ex = W * 0.5 + (targetX - W * 0.5) * ease;
  const ey = -50 + (targetY - 40) * ease;
  const wing = Math.sin(s.animT * 28) * 0.35 + 0.65;
  const scale = 0.7 + ease * 0.5;

  ctx.save();
  ctx.translate(ex, ey);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, 28, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4a3728';
  ctx.beginPath();
  ctx.ellipse(0, 4, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-5, -2, 7, 9, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c2c2c';
  ctx.beginPath();
  ctx.arc(-7, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(-18, 5);
  ctx.lineTo(-12, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#5d4037';
  const wingSpan = 34 * wing;
  ctx.beginPath();
  ctx.moveTo(4, -2);
  ctx.quadraticCurveTo(28, -18 - wingSpan * 0.2, wingSpan, -6);
  ctx.quadraticCurveTo(20, 4, 4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -2);
  ctx.quadraticCurveTo(-20, -16 - wingSpan * 0.15, -wingSpan + 4, -4);
  ctx.quadraticCurveTo(-14, 6, 4, 6);
  ctx.closePath();
  ctx.fill();

  if (p > 0.55) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(-8, 10);
    ctx.lineTo(targetX - ex, targetY - ey - 10);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  if (p > 0.7) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (p - 0.7) / 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, targetY + 20);
    ctx.restore();
  }
}
