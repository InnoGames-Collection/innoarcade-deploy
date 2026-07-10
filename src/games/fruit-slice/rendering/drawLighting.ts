// Post-process lighting — gradient overlays only (60 FPS safe).

import type { FruitType } from './types';
import { RW as W, RH as H } from './types';
import { fruitAccent } from './drawFruits';

export function drawSunWash(ctx: CanvasRenderingContext2D, time: number): void {
  const sx = W * 0.74;
  const sy = 82 + Math.sin(time * 0.25) * 2;
  const g = ctx.createRadialGradient(sx, sy, 24, sx, sy, 340);
  g.addColorStop(0, 'rgba(255, 248, 210, 0.22)');
  g.addColorStop(0.4, 'rgba(255, 225, 140, 0.09)');
  g.addColorStop(1, 'rgba(255, 200, 100, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawFruitBloom(
  ctx: CanvasRenderingContext2D,
  fruits: Array<{ x: number; y: number; sliced: boolean; type: FruitType }>,
): void {
  for (const f of fruits) {
    if (f.sliced) continue;
    const c = fruitAccent(f.type);
    const g = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, 38);
    g.addColorStop(0, c + '28');
    g.addColorStop(0.55, c + '10');
    g.addColorStop(1, c + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 38, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawWarmGrade(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255, 230, 160, 0.07)');
  g.addColorStop(0.5, 'rgba(255, 210, 120, 0.04)');
  g.addColorStop(1, 'rgba(160, 100, 50, 0.06)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawDepthVignette(ctx: CanvasRenderingContext2D): void {
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.35);
  top.addColorStop(0, 'rgba(255,255,255,0.04)');
  top.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.35);

  const bot = ctx.createLinearGradient(0, H * 0.55, 0, H);
  bot.addColorStop(0, 'rgba(0,0,0,0)');
  bot.addColorStop(1, 'rgba(15,40,10,0.16)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);
}

export function drawPlayfieldFocus(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 60, W * 0.5, H * 0.42, 320);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(30,70,20,0.07)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
