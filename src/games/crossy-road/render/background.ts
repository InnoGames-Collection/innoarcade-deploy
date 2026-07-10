// Parallax sky, mountains, and clouds — premium backdrop.

import { H, W, type WorldSnapshot } from '../types';
import type { RenderQuality } from './quality';

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

const CLOUDS: Cloud[] = [
  { x: 80, y: 90, scale: 1, speed: 6 },
  { x: 280, y: 60, scale: 0.75, speed: 4 },
  { x: 400, y: 110, scale: 0.9, speed: 5 },
  { x: 160, y: 140, scale: 0.6, speed: 3 },
];

const MOUNTAIN_LAYERS = [
  { color: '#6a9a6a', y: H * 0.42, amp: 28, freq: 0.008, parallax: 0.15 },
  { color: '#5a8a5a', y: H * 0.48, amp: 36, freq: 0.012, parallax: 0.25 },
  { color: '#4a7a4a', y: H * 0.54, amp: 22, freq: 0.015, parallax: 0.35 },
];

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  s: WorldSnapshot,
  quality: RenderQuality,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#7ec8f0');
  sky.addColorStop(0.35, '#a8e0f8');
  sky.addColorStop(0.7, '#c8eea8');
  sky.addColorStop(1, '#8ecf5a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const parallax = s.pz * 2;
  drawMountains(ctx, parallax, quality);
  if (quality.cloudCount > 0) drawClouds(ctx, s.animT, quality.cloudCount);
}

function drawMountains(
  ctx: CanvasRenderingContext2D,
  parallax: number,
  quality: RenderQuality,
): void {
  const step = quality.mountainStep;
  for (let i = 0; i < quality.mountainLayers; i++) {
    const layer = MOUNTAIN_LAYERS[i];
    if (!layer) continue;
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += step) {
      const y = layer.y + Math.sin(x * layer.freq + parallax * layer.parallax) * layer.amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, animT: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const c = CLOUDS[i];
    if (!c) continue;
    const x = ((c.x + animT * c.speed) % (W + 120)) - 60;
    drawCloudPuff(ctx, x, c.y, 34 * c.scale);
  }
}

function drawCloudPuff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.arc(x + r * 0.5, y - r * 0.15, r * 0.45, 0, Math.PI * 2);
  ctx.arc(x + r, y, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}
