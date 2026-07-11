// Bubble Pop — premium canvas rendering (presentation only).

import type { FxParticle } from './bpEffects';

export const VISUAL_SCALE = 1.18;

const BRAND = {
  green: '#00c853',
  greenLight: '#5ee89a',
  blue: '#1f74e0',
  blueDark: '#0d47a1',
  teal: '#26a69a',
};

export interface BgParticle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
  hue: 'green' | 'blue';
}

export function initBgParticles(w: number, h: number, count = 28): BgParticle[] {
  const out: BgParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 2 + Math.random() * 6,
      vx: (Math.random() - 0.5) * 12,
      vy: -8 - Math.random() * 16,
      alpha: 0.08 + Math.random() * 0.18,
      hue: Math.random() > 0.5 ? 'green' : 'blue',
    });
  }
  return out;
}

export function updateBgParticles(particles: BgParticle[], dt: number, w: number, h: number): void {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
    if (p.x < -20) p.x = w + 20;
    if (p.x > w + 20) p.x = -20;
  }
}

export function drawPremiumBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  bgParticles: BgParticle[],
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0e3d5c');
  sky.addColorStop(0.35, '#145a72');
  sky.addColorStop(0.7, '#0f4d62');
  sky.addColorStop(1, '#0a2d42');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.15, 0, w * 0.5, h * 0.3, w * 0.7);
  glow.addColorStop(0, 'rgba(94, 232, 154, 0.12)');
  glow.addColorStop(0.5, 'rgba(31, 116, 224, 0.08)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 5; i++) {
    const bx = ((i * 137 + time * 8) % (w + 100)) - 50;
    const by = 60 + i * 110 + Math.sin(time * 0.5 + i) * 20;
    const br = 18 + i * 6;
    ctx.save();
    ctx.globalAlpha = 0.06 + i * 0.01;
    const bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br);
    bg.addColorStop(0, 'rgba(255,255,255,0.5)');
    bg.addColorStop(0.5, i % 2 ? 'rgba(94,232,154,0.4)' : 'rgba(31,116,224,0.35)');
    bg.addColorStop(1, 'transparent');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const p of bgParticles) {
    ctx.save();
    ctx.globalAlpha = p.alpha * (0.7 + Math.sin(time * 2 + p.x) * 0.3);
    const c = p.hue === 'green' ? 'rgba(94,232,154,0.9)' : 'rgba(120,180,255,0.9)';
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2);
    g.addColorStop(0, c);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawPlayfieldFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  topY: number,
  bottomY: number,
  dangerY: number,
  time: number,
): void {
  const pad = 14;
  const frameTop = topY - 28;
  const frameBottom = bottomY + 8;
  const radius = 18;

  ctx.save();
  ctx.shadowColor = 'rgba(0,20,50,0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;

  const frameGrad = ctx.createLinearGradient(0, frameTop, 0, frameBottom);
  frameGrad.addColorStop(0, 'rgba(255,255,255,0.14)');
  frameGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.fillStyle = frameGrad;
  roundRect(ctx, pad, frameTop, w - pad * 2, frameBottom - frameTop, radius);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  roundRect(ctx, pad, frameTop, w - pad * 2, frameBottom - frameTop, radius);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, pad + 4, frameTop + 4, w - pad * 2 - 8, frameBottom - frameTop - 8, radius - 4);
  ctx.stroke();

  const pulse = 0.35 + Math.sin(time * 3) * 0.15;
  ctx.strokeStyle = `rgba(255, 100, 80, ${pulse})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(pad + 8, dangerY);
  ctx.lineTo(w - pad - 8, dangerY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawPremiumBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  scale: number,
  physicsR: number,
): void {
  const r = physicsR * VISUAL_SCALE * scale;
  if (r <= 0) return;

  ctx.save();

  ctx.shadowColor = 'rgba(0,20,50,0.45)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = 'rgba(0,30,60,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, r * 0.92, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.05, x, y, r);
  body.addColorStop(0, 'rgba(255,255,255,0.95)');
  body.addColorStop(0.25, lighten(color, 0.15));
  body.addColorStop(0.55, color);
  body.addColorStop(0.85, darken(color, 0.15));
  body.addColorStop(1, darken(color, 0.3));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  const inner = ctx.createRadialGradient(x, y, 0, x, y, r * 0.7);
  inner.addColorStop(0, 'rgba(255,255,255,0.12)');
  inner.addColorStop(0.6, 'transparent');
  inner.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(x + r * 0.25, y + r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export interface CannonState {
  aimAngle: number;
  recoil: number;
  breath: number;
  baseRotation: number;
  nextColor: string;
  nextSwap: number;
  time: number;
}

export function drawPremiumCannon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  state: CannonState,
  physicsR: number,
  drawBubble: (x: number, y: number, color: string, scale: number) => void,
): void {
  const breath = 1 + Math.sin(state.time * 1.8) * 0.02;
  const recoilOff = state.recoil * 14;
  const baseR = 38 * breath;

  ctx.save();
  ctx.translate(cx, cy);

  const platformGrad = ctx.createRadialGradient(0, 8, 4, 0, 0, baseR + 12);
  platformGrad.addColorStop(0, 'rgba(94,232,154,0.25)');
  platformGrad.addColorStop(0.6, 'rgba(31,116,224,0.15)');
  platformGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = platformGrad;
  ctx.beginPath();
  ctx.ellipse(0, 6, baseR + 18, baseR * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(state.baseRotation);
  ctx.fillStyle = 'rgba(0,30,60,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 10, baseR + 4, baseR * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  const baseGrad = ctx.createLinearGradient(-baseR, -baseR, baseR, baseR);
  baseGrad.addColorStop(0, '#5ee89a');
  baseGrad.addColorStop(0.4, BRAND.green);
  baseGrad.addColorStop(0.7, BRAND.blue);
  baseGrad.addColorStop(1, BRAND.blueDark);
  ctx.fillStyle = baseGrad;
  ctx.shadowColor = 'rgba(94,232,154,0.4)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, baseR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, baseR - 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate(-state.baseRotation);
  ctx.rotate(state.aimAngle);

  const barrelLen = 52 - recoilOff;
  const barrelW = 16;

  ctx.save();
  ctx.translate(-recoilOff, 0);

  const barrelGrad = ctx.createLinearGradient(0, -barrelW, 0, barrelW);
  barrelGrad.addColorStop(0, '#5ee89a');
  barrelGrad.addColorStop(0.3, BRAND.green);
  barrelGrad.addColorStop(0.6, BRAND.teal);
  barrelGrad.addColorStop(1, BRAND.blueDark);
  ctx.fillStyle = barrelGrad;
  ctx.shadowColor = 'rgba(0,200,83,0.35)';
  ctx.shadowBlur = 10;
  roundRect(ctx, -8, -barrelW / 2, barrelLen + 8, barrelW, barrelW / 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, 4, -barrelW / 2 + 3, barrelLen - 8, barrelW / 3, 3);
  ctx.fill();

  ctx.fillStyle = BRAND.blueDark;
  ctx.beginPath();
  ctx.arc(barrelLen, 0, barrelW / 2 + 2, 0, Math.PI * 2);
  ctx.fill();

  const muzzle = ctx.createRadialGradient(barrelLen, 0, 0, barrelLen, 0, barrelW);
  muzzle.addColorStop(0, 'rgba(255,255,255,0.5)');
  muzzle.addColorStop(0.5, 'rgba(94,232,154,0.3)');
  muzzle.addColorStop(1, 'transparent');
  ctx.fillStyle = muzzle;
  ctx.beginPath();
  ctx.arc(barrelLen, 0, barrelW, 0, Math.PI * 2);
  ctx.fill();

  drawBubble(barrelLen + physicsR * 0.3, 0, state.nextColor, 0.95);
  ctx.restore();

  ctx.restore();

  drawNextHolder(ctx, cx - 62, cy + 8, state, drawBubble);
}

function drawNextHolder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  state: CannonState,
  drawBubble: (x: number, y: number, color: string, scale: number) => void,
): void {
  const swap = state.nextSwap;
  const holderR = 24;
  const offsetY = swap > 0 ? -swap * 30 : 0;
  const alpha = swap > 0 ? 1 - swap : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  const holderGrad = ctx.createLinearGradient(x - holderR, y - holderR, x + holderR, y + holderR);
  holderGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
  holderGrad.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = holderGrad;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(0,20,50,0.3)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x, y + offsetY, holderR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  drawBubble(x, y + offsetY, state.nextColor, 0.88);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 9px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEXT', x, y + holderR + 14);
  ctx.restore();
}

export function drawAimGuide(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  physicsR: number,
  w: number,
  time: number,
): void {
  let x = cx;
  let y = cy;
  let vx = Math.cos(angle);
  let vy = Math.sin(angle);

  ctx.save();
  ctx.shadowColor = 'rgba(94,232,154,0.5)';
  ctx.shadowBlur = 6;

  for (let i = 0; i < 32; i++) {
    x += vx * 16;
    y += vy * 16;
    if (x < physicsR) { x = physicsR; vx = Math.abs(vx); }
    if (x > w - physicsR) { x = w - physicsR; vx = -Math.abs(vx); }
    if (y < 36) break;

    const dash = (time * 6 + i * 0.4) % 1;
    const dotR = 2.5 + dash * 1.5;
    const alpha = 0.25 + (1 - i / 32) * 0.55;

    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, dotR * 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(94,232,154,0.7)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = 'rgba(94,232,154,0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  x = cx;
  y = cy;
  vx = Math.cos(angle);
  vy = Math.sin(angle);
  ctx.moveTo(x, y);
  for (let i = 0; i < 32; i++) {
    x += vx * 16;
    y += vy * 16;
    if (x < physicsR) { x = physicsR; vx = Math.abs(vx); }
    if (x > w - physicsR) { x = w - physicsR; vx = -Math.abs(vx); }
    ctx.lineTo(x, y);
    if (y < 36) break;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function lighten(hex: string, amt: number): string {
  return shiftColor(hex, amt);
}

function darken(hex: string, amt: number): string {
  return shiftColor(hex, -amt);
}

function shiftColor(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 0xff) + Math.round(amt * 255)));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + Math.round(amt * 255)));
  const b = Math.min(255, Math.max(0, (n & 0xff) + Math.round(amt * 255)));
  return `rgb(${r},${g},${b})`;
}
