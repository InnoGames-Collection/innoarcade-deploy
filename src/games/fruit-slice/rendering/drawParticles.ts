// Juice particles — simulation API (called by game engine) + draw routines.

import type { FruitType, VfxParticle } from './types';
import { fruitPalette } from './drawFruits';

const MAX = 60;

export function createJuiceBurst(particles: VfxParticle[], x: number, y: number, type: FruitType): void {
  const pal = fruitPalette(type);
  const room = MAX - particles.length;
  if (room <= 0) return;

  const nJ = Math.min(9, room);
  for (let i = 0; i < nJ; i++) {
    const a = (i / nJ) * Math.PI * 2 + Math.random() * 0.4;
    const spd = 95 + Math.random() * 130;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 35,
      life: 0, maxLife: 0.38 + Math.random() * 0.32,
      size: 5 + Math.random() * 7, color: pal.juice, kind: 'juice',
      rotation: Math.random() * 6.28, rotSpeed: (Math.random() - 0.5) * 7,
    });
  }
  const nP = Math.min(5, MAX - particles.length);
  for (let i = 0; i < nP; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 55 + Math.random() * 95;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0, maxLife: 0.48 + Math.random() * 0.35,
      size: 3 + Math.random() * 4, color: pal.light, kind: 'pulp',
      rotation: Math.random() * 6.28, rotSpeed: (Math.random() - 0.5) * 11,
    });
  }
  const nS = Math.min(3, MAX - particles.length);
  for (let i = 0; i < nS; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 75 + Math.random() * 110;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0, maxLife: 0.55 + Math.random() * 0.28,
      size: 1.8 + Math.random() * 2, color: pal.seed, kind: 'seed',
      rotation: Math.random() * 6.28, rotSpeed: (Math.random() - 0.5) * 14,
    });
  }
  const nD = Math.min(4, MAX - particles.length);
  for (let i = 0; i < nD; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 130 + Math.random() * 75;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0, maxLife: 0.28 + Math.random() * 0.22,
      size: 2 + Math.random() * 2.5, color: pal.juice, kind: 'droplet',
      rotation: 0, rotSpeed: 0,
    });
  }
  const nM = Math.min(2, MAX - particles.length);
  for (let i = 0; i < nM; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30,
      life: 0, maxLife: 0.6 + Math.random() * 0.3,
      size: 8 + Math.random() * 10, color: pal.juice + '88', kind: 'mist',
      rotation: 0, rotSpeed: 0,
    });
  }
}

export function createBombBurst(particles: VfxParticle[], x: number, y: number): void {
  const room = MAX - particles.length;
  const n = Math.min(10, room);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const spd = 95 + Math.random() * 95;
    particles.push({
      x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 0, maxLife: 0.38 + Math.random() * 0.28,
      size: 4 + Math.random() * 5, color: i % 2 === 0 ? '#ff4444' : '#ff9900', kind: 'spark',
      rotation: 0, rotSpeed: 0,
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
    ctx.save();
    ctx.globalAlpha = t * (p.kind === 'mist' ? 0.45 : 1);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    if (p.kind === 'juice' || p.kind === 'mist') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * t);
      g.addColorStop(0, p.color);
      g.addColorStop(0.55, p.color);
      g.addColorStop(1, p.color.slice(0, 7) + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * t, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'droplet') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.45 * t, p.size * t, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'seed') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.55 * t, p.size * t, 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * t * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
