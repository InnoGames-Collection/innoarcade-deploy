// Real fruit photo rendering — uses preloaded photographic assets.

import type { FruitType } from './types';
import { getFruitImage } from './fruitImages';

interface Palette {
  base: string;
  juice: string;
  light: string;
  seed: string;
}

const PAL: Record<FruitType, Palette> = {
  apple:  { base: '#c41e1e', juice: '#f0d060', light: '#fff5e0', seed: '#5c3d1e' },
  banana: { base: '#f5d020', juice: '#f0e060', light: '#fffde8', seed: '#6b4423' },
  cherry: { base: '#c01020', juice: '#c01020', light: '#ff5060', seed: '#2a1810' },
  orange: { base: '#f07818', juice: '#ff9020', light: '#ffb840', seed: '#fef3c7' },
  peach:  { base: '#ff9030', juice: '#f0b030', light: '#ffe080', seed: '#5c3d1e' },
};

/** Circular clip hides white photo backgrounds; banana PNG keeps transparency. */
const CIRCULAR: Record<FruitType, boolean> = {
  apple: true,
  banana: false,
  cherry: true,
  orange: true,
  peach: true,
};

export function fruitAccent(type: FruitType): string {
  return PAL[type].base;
}

export function fruitPalette(type: FruitType): Palette {
  return PAL[type];
}

function imageSize(img: HTMLImageElement, radius: number): [number, number] {
  const max = radius * 2.2;
  const aspect = img.width / img.height;
  if (aspect >= 1) return [max, max / aspect];
  return [max * aspect, max];
}

function paintFruitImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  radius: number,
  type: FruitType,
): void {
  const [w, h] = imageSize(img, radius);
  const useCircle = CIRCULAR[type];

  if (useCircle) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.97, 0, Math.PI * 2);
    ctx.clip();
  }

  ctx.drawImage(img, -w / 2, -h / 2, w, h);

  if (useCircle) ctx.restore();
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

  const [w, h] = imageSize(img, radius);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);

  // Fresh moist cut edge
  ctx.strokeStyle = p.juice;
  ctx.globalAlpha = alpha * 0.55;
  ctx.lineWidth =  2;
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, radius);
  ctx.stroke();

  ctx.restore();
}
