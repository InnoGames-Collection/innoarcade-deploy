// Visual effects — juice splashes, slice trails, combo bursts, ambient particles.

import type { FruitType } from './fruits';
import { getFruitPalette } from './fruits';

export type ParticleKind = 'juice' | 'pulp' | 'seed' | 'spark' | 'droplet' | 'leaf' | 'glow' | 'streak';

export interface VfxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: ParticleKind;
  rotation: number;
  rotSpeed: number;
}

export interface SliceTrail {
  points: Array<{ x: number; y: number }>;
  createdAt: number;
  sparks: Array<{ x: number; y: number; life: number }>;
}

const MAX_PARTICLES = 60;

export function createJuiceBurst(
  particles: VfxParticle[],
  x: number,
  y: number,
  type: FruitType,
): void {
  const pal = getFruitPalette(type);
  const room = MAX_PARTICLES - particles.length;
  if (room <= 0) return;

  const juiceCount = Math.min(8, room);
  for (let i = 0; i < juiceCount; i++) {
    const angle = (i / juiceCount) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 100 + Math.random() * 140;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0,
      maxLife: 0.4 + Math.random() * 0.35,
      size: 5 + Math.random() * 8,
      color: pal.juice,
      kind: 'juice',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 8,
    });
  }

  const pulpCount = Math.min(5, MAX_PARTICLES - particles.length);
  for (let i = 0; i < pulpCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.4,
      size: 3 + Math.random() * 5,
      color: pal.light,
      kind: 'pulp',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 12,
    });
  }

  const seedCount = Math.min(3, MAX_PARTICLES - particles.length);
  for (let i = 0; i < seedCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.3,
      size: 2 + Math.random() * 2,
      color: pal.seed,
      kind: 'seed',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 15,
    });
  }

  const dropletCount = Math.min(4, MAX_PARTICLES - particles.length);
  for (let i = 0; i < dropletCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 140 + Math.random() * 80;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.3 + Math.random() * 0.25,
      size: 2 + Math.random() * 3,
      color: pal.juice,
      kind: 'droplet',
      rotation: 0,
      rotSpeed: 0,
    });
  }
}

export function createBombBurst(particles: VfxParticle[], x: number, y: number): void {
  const room = MAX_PARTICLES - particles.length;
  const n = Math.min(10, room);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const speed = 100 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.4 + Math.random() * 0.3,
      size: 4 + Math.random() * 6,
      color: i % 2 === 0 ? '#ff4444' : '#ff8800',
      kind: 'spark',
      rotation: 0,
      rotSpeed: 0,
    });
  }
}

export function updateParticles(particles: VfxParticle[], dt: number): void {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 480 * dt;
    p.vx *= 1 - dt * 0.5;
    p.life += dt;
    p.rotation += p.rotSpeed * dt;
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: VfxParticle[]): void {
  for (const p of particles) {
    const t = 1 - p.life / p.maxLife;
    if (t <= 0) continue;
    const alpha = t * (p.kind === 'glow' ? 0.6 : 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    if (p.kind === 'juice') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * t);
      g.addColorStop(0, p.color);
      g.addColorStop(0.6, p.color + 'aa');
      g.addColorStop(1, p.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * t, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'droplet') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.5 * t, p.size * t, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'seed') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.6 * t, p.size * t, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'spark' || p.kind === 'glow') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * t * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'leaf') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.4 * t, p.size * t, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * t, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export function drawSliceTrail(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  age: number,
  maxAge: number,
): void {
  if (points.length < 2) return;
  const alpha = Math.max(0, 1 - age / maxAge);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Motion-blur style: faded wider under-stroke
  ctx.strokeStyle = `rgba(120, 190, 255, ${alpha * 0.35})`;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.strokeStyle = `rgba(200, 230, 255, ${alpha * 0.55})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  // Spark tips along the trail
  for (let i = 1; i < points.length; i += 2) {
    const p = points[i];
    ctx.fillStyle = `rgba(220, 240, 255, ${alpha * 0.7})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawComboEffect(
  ctx: CanvasRenderingContext2D,
  combo: number,
  flashT: number,
  cx: number,
  cy: number,
): void {
  if (combo < 2 || flashT <= 0) return;
  const t = flashT;
  const alpha = Math.min(1, t * 3);

  ctx.save();
  ctx.globalAlpha = alpha * 0.35;

  if (combo >= 20) {
    const hue = (Date.now() / 20) % 360;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 200);
    g.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.5)`);
    g.addColorStop(0.5, `hsla(${(hue + 60) % 360}, 80%, 55%, 0.25)`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, 720);
  } else if (combo >= 10) {
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 180);
    g.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
    g.addColorStop(0.4, 'rgba(255, 180, 0, 0.3)');
    g.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, 720);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 4;
      ctx.fillStyle = `rgba(255, 230, 100, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 80 * (1 - t), cy + Math.sin(a) * 60 * (1 - t), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (combo >= 5) {
    ctx.strokeStyle = `rgba(255, 255, 100, ${alpha * 0.7})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ox = (Math.random() - 0.5) * 200;
      ctx.beginPath();
      ctx.moveTo(cx + ox, 0);
      ctx.lineTo(cx + ox + (Math.random() - 0.5) * 30, 200);
      ctx.stroke();
    }
  } else if (combo >= 3) {
    const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 120);
    g.addColorStop(0, `rgba(255, 140, 40, ${alpha * 0.4})`);
    g.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 120, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 80);
    g.addColorStop(0, `rgba(255, 220, 150, ${alpha * 0.3})`);
    g.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 80, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawFruitGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  const g = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 1.6);
  g.addColorStop(0, color + '22');
  g.addColorStop(0.5, color + '11');
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.6, 0, Math.PI * 2);
  ctx.fill();
}
