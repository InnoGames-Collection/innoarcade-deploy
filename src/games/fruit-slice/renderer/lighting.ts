// Cheap post-process lighting — additive overlays only (no ctx.filter).

import type { FruitType } from './fruits';
import { BG_W as W, BG_H as H } from './background';

export function drawWarmGrade(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255, 220, 140, 0.06)');
  g.addColorStop(0.45, 'rgba(255, 200, 100, 0.03)');
  g.addColorStop(1, 'rgba(180, 120, 60, 0.05)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawSunWash(ctx: CanvasRenderingContext2D, time: number): void {
  const sunX = W * 0.78;
  const sunY = 95 + Math.sin(time * 0.3) * 3;
  const g = ctx.createRadialGradient(sunX, sunY, 30, sunX, sunY, 320);
  g.addColorStop(0, 'rgba(255, 245, 200, 0.14)');
  g.addColorStop(0.45, 'rgba(255, 230, 150, 0.06)');
  g.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawPlayfieldBloom(
  ctx: CanvasRenderingContext2D,
  fruits: Array<{ x: number; y: number; sliced: boolean; type: FruitType }>,
  getColor: (type: FruitType) => string,
): void {
  for (const f of fruits) {
    if (f.sliced) continue;
    const c = getColor(f.type);
    const g = ctx.createRadialGradient(f.x, f.y, 6, f.x, f.y, 34);
    g.addColorStop(0, c + '18');
    g.addColorStop(1, c + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 34, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawDepthVignette(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, 'rgba(20,50,15,0.06)');
  g.addColorStop(1, 'rgba(15,40,10,0.14)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
