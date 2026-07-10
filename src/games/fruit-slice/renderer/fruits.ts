// Premium canvas-drawn fruits and bombs with gloss, shadows, and highlights.

export type FruitType = 'apple' | 'banana' | 'cherry' | 'orange' | 'peach';

export interface FruitPalette {
  base: string;
  dark: string;
  light: string;
  accent: string;
  juice: string;
  seed: string;
}

const PALETTES: Record<FruitType, FruitPalette> = {
  apple: { base: '#ef4444', dark: '#991b1b', light: '#fca5a5', accent: '#15803d', juice: '#dc2626', seed: '#5c3d1e' },
  banana: { base: '#facc15', dark: '#ca8a04', light: '#fef08a', accent: '#92400e', juice: '#eab308', seed: '#6b4423' },
  cherry: { base: '#b91c1c', dark: '#7f1d1d', light: '#f87171', accent: '#166534', juice: '#991b1b', seed: '#3d2817' },
  orange: { base: '#f97316', dark: '#c2410c', light: '#fdba74', accent: '#15803d', juice: '#ea580c', seed: '#fef3c7' },
  peach: { base: '#fda4af', dark: '#e879a0', light: '#ffe4e6', accent: '#15803d', juice: '#fb7185', seed: '#5c3d1e' },
};

export function getFruitPalette(type: FruitType): FruitPalette {
  return PALETTES[type];
}

export function getFruitColor(type: FruitType): string {
  return PALETTES[type].base;
}

export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha = 0.25,
): void {
  ctx.save();
  ctx.fillStyle = `rgba(20, 40, 15, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.85, radius * 0.9, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFruit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  type: FruitType,
  rotation: number,
  scale = 1,
): void {
  const pal = PALETTES[type];
  const r = radius * scale;

  drawShadow(ctx, x, y, r);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  if (type === 'banana') {
    drawBanana(ctx, r, pal);
  } else if (type === 'cherry') {
    drawCherry(ctx, r, pal);
  } else {
    drawRoundFruit(ctx, r, pal, type);
  }

  ctx.restore();
}

function drawRoundFruit(
  ctx: CanvasRenderingContext2D,
  r: number,
  pal: FruitPalette,
  type: FruitType,
): void {
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, pal.light);
  grad.addColorStop(0.55, pal.base);
  grad.addColorStop(1, pal.dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'apple' || type === 'peach') {
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.95, r * 0.15, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c3d1e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.quadraticCurveTo(r * 0.3, -r * 1.1, r * 0.5, -r * 0.9);
    ctx.stroke();
  }

  if (type === 'orange') {
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.35)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.92, r * 0.1, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.24, r * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Rim light
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, -Math.PI * 0.7, Math.PI * 0.1);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.15, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(r * 0.2, r * 0.15, r * 0.12, 0, Math.PI);
  ctx.stroke();
}

function drawBanana(ctx: CanvasRenderingContext2D, r: number, pal: FruitPalette): void {
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, pal.light);
  grad.addColorStop(0.5, pal.base);
  grad.addColorStop(1, pal.dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.5);
  ctx.quadraticCurveTo(-r * 0.8, -r * 0.2, -r * 0.2, -r * 0.7);
  ctx.quadraticCurveTo(r * 0.3, -r * 0.9, r * 0.6, -r * 0.3);
  ctx.quadraticCurveTo(r * 0.9, r * 0.3, r * 0.2, r * 0.7);
  ctx.quadraticCurveTo(-r * 0.1, r * 0.9, -r * 0.3, r * 0.5);
  ctx.fill();

  ctx.strokeStyle = 'rgba(139, 105, 20, 0.3)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1 + t * r * 0.3, -r * 0.5 + t * r * 0.8);
    ctx.lineTo(r * 0.1 + t * r * 0.3, -r * 0.3 + t * r * 0.7);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.1, -r * 0.35, r * 0.15, r * 0.08, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCherry(ctx: CanvasRenderingContext2D, r: number, pal: FruitPalette): void {
  ctx.strokeStyle = '#2d5016';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.5);
  ctx.quadraticCurveTo(r * 0.5, -r * 1.2, r * 0.7, -r * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.5);
  ctx.quadraticCurveTo(-r * 0.5, -r * 1.2, -r * 0.7, -r * 0.8);
  ctx.stroke();

  for (const ox of [-r * 0.35, r * 0.35]) {
    const grad = ctx.createRadialGradient(ox - r * 0.1, -r * 0.1, 1, ox, 0, r * 0.55);
    grad.addColorStop(0, pal.light);
    grad.addColorStop(0.6, pal.base);
    grad.addColorStop(1, pal.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ox, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(ox - r * 0.12, -r * 0.15, r * 0.1, r * 0.07, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBomb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  time: number,
): void {
  drawShadow(ctx, x, y, radius, 0.35);

  const pulse = 1 + Math.sin(time * 8) * 0.03;
  const r = radius * pulse;

  const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 2, x, y, r);
  grad.addColorStop(0, '#555');
  grad.addColorStop(0.6, '#2a2a2a');
  grad.addColorStop(1, '#111');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.3, r * 0.2, r * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + 6, y - r - 10, x + 4, y - r - 16);
  ctx.stroke();

  const spark = Math.sin(time * 20) > 0.5;
  if (spark) {
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(x + 4, y - r - 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(x + 4, y - r - 18, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💣', x, y + 1);
}

export function drawSlicedHalf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  type: FruitType,
  side: -1 | 1,
  alpha: number,
): void {
  const pal = PALETTES[type];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
  grad.addColorStop(0, pal.light);
  grad.addColorStop(0.7, pal.base);
  grad.addColorStop(1, pal.dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, side === -1 ? Math.PI * 0.5 : -Math.PI * 0.5, side === -1 ? Math.PI * 1.5 : Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal.juice;
  ctx.globalAlpha = alpha * 0.7;
  ctx.beginPath();
  ctx.ellipse(side * radius * 0.15, 0, radius * 0.35, radius * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
