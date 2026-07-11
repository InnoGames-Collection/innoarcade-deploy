// Premium real-fruit photo rendering — studio assets with gloss & depth.

import type { FruitType } from './types';
import { getFruitImage } from './fruitImages';

interface Palette {
  base: string;
  juice: string;
  light: string;
  seed: string;
  flesh: string;
  fleshDark: string;
}

const PAL: Record<FruitType, Palette> = {
  apple:  { base: '#c41e1e', juice: '#f0d060', light: '#fff5e0', seed: '#5c3d1e', flesh: '#fff5e0', fleshDark: '#f0e0c0' },
  banana: { base: '#f5d020', juice: '#f0e060', light: '#fffde8', seed: '#6b4423', flesh: '#fffde8', fleshDark: '#f5f0d0' },
  cherry: { base: '#c01020', juice: '#c01020', light: '#ff5060', seed: '#2a1810', flesh: '#ff3040', fleshDark: '#c01020' },
  orange: { base: '#f07818', juice: '#ff9020', light: '#ffb840', seed: '#fef3c7', flesh: '#ffb840', fleshDark: '#f09020' },
  peach:  { base: '#ff9030', juice: '#f0b030', light: '#ffe080', seed: '#5c3d1e', flesh: '#ffe080', fleshDark: '#f0a840' },
};

/** Per-fruit display scale — tuned for trimmed studio assets. */
const SCALE: Record<FruitType, number> = {
  apple: 2.35,
  banana: 2.55,
  cherry: 2.45,
  orange: 2.3,
  peach: 2.35,
};

export function fruitAccent(type: FruitType): string {
  return PAL[type].base;
}

export function fruitPalette(type: FruitType): Palette {
  return PAL[type];
}

function imageSize(img: HTMLImageElement, radius: number, type: FruitType): [number, number] {
  const max = radius * SCALE[type];
  const aspect = img.width / img.height;
  if (aspect >= 1) return [max, max / aspect];
  return [max * aspect, max];
}

function applyPremiumFinish(ctx: CanvasRenderingContext2D, radius: number, type: FruitType): void {
  // Subtle colour vibrancy
  ctx.globalCompositeOperation = 'soft-light';
  const vibrancy = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
  vibrancy.addColorStop(0, 'rgba(255,255,255,0.12)');
  vibrancy.addColorStop(0.6, 'rgba(255,255,255,0)');
  vibrancy.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = vibrancy;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Top-left specular gloss
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.beginPath();
  ctx.ellipse(-radius * 0.28, -radius * 0.32, radius * 0.2, radius * 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(-radius * 0.1, -radius * 0.1, radius * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Ambient occlusion at lower edge
  const ao = ctx.createLinearGradient(0, radius * 0.1, 0, radius);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = ao;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.98, 0, Math.PI * 2);
  ctx.fill();

  // Rim catch-light
  ctx.strokeStyle = PAL[type].light;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.94, -Math.PI * 0.75, Math.PI * 0.25);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function paintFruitImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  radius: number,
  type: FruitType,
): void {
  const [w, h] = imageSize(img, radius, type);

  ctx.drawImage(img, -w / 2, -h / 2, w, h);

  // Gloss & AO only on fruit pixels, not transparent areas
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  applyPremiumFinish(ctx, radius, type);
  ctx.restore();
}

export function drawFruit(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  type: FruitType, rotation: number,
  sliceTime = 0,
): void {
  const img = getFruitImage(type);
  if (!img) return;

  let squashX = 1;
  let squashY = 1;
  if (sliceTime > 0 && sliceTime < 0.06) {
    const t = sliceTime / 0.06;
    squashX = 1 + (1 - t) * 0.18;
    squashY = 1 - (1 - t) * 0.14;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squashX, squashY);
  ctx.rotate(rotation);
  paintFruitImage(ctx, img, radius, type);
  ctx.restore();
}

function paintSliceInterior(
  ctx: CanvasRenderingContext2D,
  radius: number,
  p: Palette,
  type: FruitType,
  side: -1 | 1,
): void {
  const flesh = ctx.createRadialGradient(side * radius * 0.08, -radius * 0.05, 2, 0, 0, radius * 0.88);
  flesh.addColorStop(0, p.flesh);
  flesh.addColorStop(0.55, p.fleshDark);
  flesh.addColorStop(1, p.juice + 'cc');
  ctx.fillStyle = flesh;
  ctx.fillRect(-radius, -radius, radius, radius * 2);

  if (type === 'orange') {
    ctx.strokeStyle = 'rgba(255,200,80,0.45)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius * 0.75, Math.sin(a) * radius * 0.75);
      ctx.stroke();
    }
  }

  if (type === 'apple') {
    ctx.fillStyle = '#c8a060';
    ctx.beginPath();
    ctx.ellipse(side * radius * 0.06, 0, radius * 0.1, radius * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moist sheen on cut face
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(side * radius * 0.12, -radius * 0.18, radius * 0.14, radius * 0.05, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSlicedHalf(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  type: FruitType, side: -1 | 1, alpha: number,
): void {
  const img = getFruitImage(type);
  const p = PAL[type];
  if (!img) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  const start = side === -1 ? Math.PI * 0.5 : -Math.PI * 0.5;
  const end = side === -1 ? Math.PI * 1.5 : Math.PI * 0.5;

  ctx.beginPath();
  ctx.arc(0, 0, radius, start, end);
  ctx.closePath();
  ctx.clip();

  const [w, h] = imageSize(img, radius, type);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);

  // Overlay fresh interior on cut half
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, radius);
  if (side === -1) {
    ctx.arc(0, 0, radius, Math.PI * 0.5, Math.PI * 1.5);
  } else {
    ctx.arc(0, 0, radius, -Math.PI * 0.5, Math.PI * 0.5);
  }
  ctx.closePath();
  ctx.clip();
  paintSliceInterior(ctx, radius, p, type, side);
  ctx.restore();

  // Juicy cut edge
  const edge = ctx.createLinearGradient(0, -radius, 0, radius);
  edge.addColorStop(0, p.juice + '00');
  edge.addColorStop(0.45, p.juice + 'aa');
  edge.addColorStop(0.55, p.juice + 'aa');
  edge.addColorStop(1, p.juice + '00');
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, radius);
  ctx.stroke();

  ctx.restore();
}
