/** Canvas helpers for glossy illustrated game objects (new arcade titles). */

import { gemIdFromHex, gemIdFromIndex, type GemId } from './premiumGems';

interface GemStops {
  light: string;
  mid: string;
  dark: string;
}

const GEM_STOPS: Record<GemId, GemStops> = {
  sapphire: { light: '#b8d4ff', mid: '#5b8cff', dark: '#2a4db8' },
  emerald: { light: '#8ef0b8', mid: '#2ecc71', dark: '#1a7a42' },
  amber: { light: '#ffe08a', mid: '#f39c12', dark: '#b86a08' },
  ruby: { light: '#ff9aab', mid: '#e74c3c', dark: '#9c2418' },
  amethyst: { light: '#d4b8ff', mid: '#9b59b6', dark: '#5c2d78' },
  aquamarine: { light: '#8af0e8', mid: '#1abc9c', dark: '#0d7a68' },
  coral: { light: '#ffb89a', mid: '#e67e22', dark: '#a04a10' },
  violet: { light: '#c4b8ff', mid: '#6c5ce7', dark: '#3d28a8' },
};

function stopsForHex(hex: string): GemStops {
  const id = gemIdFromHex(hex);
  return GEM_STOPS[id];
}

function stopsForIndex(index: number): GemStops {
  const id = gemIdFromIndex(index);
  return GEM_STOPS[id];
}

function glossGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  stops: GemStops,
  vertical = true,
): CanvasGradient {
  const g = vertical
    ? ctx.createLinearGradient(x, y, x, y + h)
    : ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, stops.light);
  g.addColorStop(0.42, stops.mid);
  g.addColorStop(1, stops.dark);
  return g;
}

export function drawGemRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  radius = 6,
): void {
  const stops = stopsForHex(color);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = glossGradient(ctx, x, y, w, h, stops);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.28, y + h * 0.22, w * 0.18, h * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
  ctx.restore();
}

export function drawGemCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  colorOrIndex: string | number,
): void {
  const stops = typeof colorOrIndex === 'number'
    ? stopsForIndex(colorOrIndex)
    : stopsForHex(colorOrIndex);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = glossGradient(ctx, cx - r, cy - r, r * 2, r * 2, stops);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.32, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
  ctx.restore();
}

export function drawIllustratedCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bodyColor: string,
  windowColor = '#dff4ff',
): void {
  const stops = stopsForHex(bodyColor);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.15, w, h * 0.85, 8);
  ctx.fillStyle = glossGradient(ctx, x, y, w, h, stops);
  ctx.fill();
  ctx.fillStyle = windowColor;
  ctx.beginPath();
  ctx.roundRect(x + w * 0.15, y + h * 0.22, w * 0.7, h * 0.28, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.22, y + h * 0.92, w * 0.14, h * 0.08, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.78, y + h * 0.92, w * 0.14, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
