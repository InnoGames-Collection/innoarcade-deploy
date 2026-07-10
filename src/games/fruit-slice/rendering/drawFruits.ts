// Premium glossy fruit artwork — canvas-only painterly style.

import type { FruitType } from './types';

interface Palette {
  base: string;
  dark: string;
  light: string;
  accent: string;
  juice: string;
  seed: string;
  rim: string;
}

const PAL: Record<FruitType, Palette> = {
  apple:  { base: '#ef4444', dark: '#991b1b', light: '#fca5a5', accent: '#15803d', juice: '#dc2626', seed: '#5c3d1e', rim: '#ff8080' },
  banana: { base: '#facc15', dark: '#a16207', light: '#fef08a', accent: '#854d0e', juice: '#eab308', seed: '#6b4423', rim: '#fff566' },
  cherry: { base: '#b91c1c', dark: '#7f1d1d', light: '#f87171', accent: '#166534', juice: '#991b1b', seed: '#3d2817', rim: '#ff6b6b' },
  orange: { base: '#f97316', dark: '#c2410c', light: '#fdba74', accent: '#15803d', juice: '#ea580c', seed: '#fef3c7', rim: '#ffb366' },
  peach:  { base: '#fda4af', dark: '#e879a0', light: '#ffe4e6', accent: '#15803d', juice: '#fb7185', seed: '#5c3d1e', rim: '#ffc9d0' },
};

export function fruitAccent(type: FruitType): string {
  return PAL[type].base;
}

export function fruitPalette(type: FruitType): Palette {
  return PAL[type];
}

function dropShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a = 0.28): void {
  ctx.save();
  ctx.fillStyle = `rgba(10,30,8,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.88, r * 0.95, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFruit(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  type: FruitType, rotation: number,
): void {
  dropShadow(ctx, x, y, radius);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  if (type === 'banana') paintBanana(ctx, radius, PAL.banana);
  else if (type === 'cherry') paintCherry(ctx, radius, PAL.cherry);
  else paintRound(ctx, radius, PAL[type], type);
  ctx.restore();
}

function paintRound(ctx: CanvasRenderingContext2D, r: number, p: Palette, type: FruitType): void {
  const body = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.08, r * 0.05, r * 0.05, r);
  body.addColorStop(0, p.light);
  body.addColorStop(0.45, p.base);
  body.addColorStop(0.85, p.dark);
  body.addColorStop(1, p.dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'apple' || type === 'peach') {
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.94, r * 0.14, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c3d1e';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.84);
    ctx.quadraticCurveTo(r * 0.28, -r * 1.08, r * 0.48, -r * 0.88);
    ctx.stroke();
  }
  if (type === 'orange') {
    ctx.strokeStyle = 'rgba(255,200,100,0.3)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
      ctx.stroke();
    }
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.9, r * 0.1, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.34, r * 0.24, r * 0.15, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(-r * 0.14, -r * 0.14, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.rim;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, -Math.PI * 0.65, Math.PI * 0.15);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function paintBanana(ctx: CanvasRenderingContext2D, r: number, p: Palette): void {
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, p.light);
  g.addColorStop(0.45, p.base);
  g.addColorStop(1, p.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, r * 0.48);
  ctx.quadraticCurveTo(-r * 0.78, -r * 0.18, -r * 0.18, -r * 0.68);
  ctx.quadraticCurveTo(r * 0.28, -r * 0.88, r * 0.58, -r * 0.28);
  ctx.quadraticCurveTo(r * 0.88, r * 0.28, r * 0.18, r * 0.68);
  ctx.quadraticCurveTo(-r * 0.08, r * 0.88, -r * 0.28, r * 0.48);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,10,0.28)';
  ctx.lineWidth = 0.55;
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.08 + t * r * 0.28, -r * 0.48 + t * r * 0.76);
    ctx.lineTo(r * 0.08 + t * r * 0.28, -r * 0.28 + t * r * 0.68);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.08, -r * 0.32, r * 0.14, r * 0.07, -0.38, 0, Math.PI * 2);
  ctx.fill();
}

function paintCherry(ctx: CanvasRenderingContext2D, r: number, p: Palette): void {
  ctx.strokeStyle = '#166534';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.48);
  ctx.quadraticCurveTo(r * 0.48, -r * 1.15, r * 0.68, -r * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.48);
  ctx.quadraticCurveTo(-r * 0.48, -r * 1.15, -r * 0.68, -r * 0.75);
  ctx.stroke();
  for (const ox of [-r * 0.34, r * 0.34]) {
    const g = ctx.createRadialGradient(ox - r * 0.1, -r * 0.1, 1, ox, 0, r * 0.54);
    g.addColorStop(0, p.light);
    g.addColorStop(0.55, p.base);
    g.addColorStop(1, p.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ox, 0, r * 0.54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(ox - r * 0.11, -r * 0.14, r * 0.09, r * 0.06, -0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawSlicedHalf(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  type: FruitType, side: -1 | 1, alpha: number,
): void {
  const p = PAL[type];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
  g.addColorStop(0, p.light);
  g.addColorStop(0.65, p.base);
  g.addColorStop(1, p.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  const start = side === -1 ? Math.PI * 0.5 : -Math.PI * 0.5;
  const end = side === -1 ? Math.PI * 1.5 : Math.PI * 0.5;
  ctx.arc(0, 0, radius, start, end);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.juice;
  ctx.globalAlpha = alpha * 0.75;
  ctx.beginPath();
  ctx.ellipse(side * radius * 0.14, 0, radius * 0.34, radius * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
