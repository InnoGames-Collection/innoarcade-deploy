// Bubble Pop — floating text, combo banners, impact flashes (presentation only).

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
  vy: number;
}

export interface ImpactFlash {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface ComboBanner {
  text: string;
  life: number;
  maxLife: number;
  level: number;
}

export type ParticleKind = 'dot' | 'sparkle' | 'fragment' | 'glow' | 'star';

export interface FxParticle {
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
  spin: number;
}

const COMBO_LABELS: Record<number, string> = {
  2: 'Combo ×2',
  3: 'Combo ×3',
  4: 'Combo ×4',
  5: 'Fire Combo!',
  6: 'Chain Bonus!',
  7: 'Amazing!',
  8: 'Excellent!',
};

export function comboLabel(level: number): string {
  if (level >= 8) return COMBO_LABELS[8];
  if (level >= 5) return level === 5 ? COMBO_LABELS[5] : COMBO_LABELS[6];
  return COMBO_LABELS[level] ?? `Combo ×${level}`;
}

export function matchLabel(count: number): string | null {
  if (count >= 8) return 'Perfect Match!';
  if (count >= 6) return 'Amazing!';
  if (count >= 5) return 'Excellent!';
  return null;
}

export function scoreLabel(points: number): string {
  if (points >= 100) return `+${points}`;
  if (points >= 50) return `+${points}`;
  if (points >= 20) return `+${points}`;
  return `+${points}`;
}

export function spawnFloatText(
  list: FloatText[],
  x: number,
  y: number,
  text: string,
  color = '#fff',
  scale = 1,
): void {
  list.push({
    x, y, text, color, scale,
    life: 0, maxLife: 0.9,
    vy: -55,
  });
}

export function spawnComboBanner(list: ComboBanner[], level: number): void {
  list.push({
    text: comboLabel(level),
    life: 0,
    maxLife: 1.4,
    level,
  });
}

export function spawnImpact(list: ImpactFlash[], x: number, y: number, color: string): void {
  list.push({ x, y, life: 0, maxLife: 0.18, color });
}

export function spawnPopBurst(
  list: FxParticle[],
  x: number,
  y: number,
  color: string,
  intensity = 1,
): void {
  const n = Math.floor(14 * intensity);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 90 + Math.random() * 140;
    const kind: ParticleKind = i % 5 === 0 ? 'star' : i % 3 === 0 ? 'sparkle' : 'fragment';
    list.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0,
      maxLife: 0.35 + Math.random() * 0.35,
      size: 3 + Math.random() * 5,
      color,
      kind,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 8,
    });
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    list.push({
      x, y,
      vx: Math.cos(a) * 40,
      vy: Math.sin(a) * 40 - 30,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.3,
      size: 8 + Math.random() * 10,
      color: 'rgba(255,255,255,0.7)',
      kind: 'glow',
      rotation: 0,
      spin: 0,
    });
  }
}

export function spawnImpactBurst(list: FxParticle[], x: number, y: number, color: string): void {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    list.push({
      x, y,
      vx: Math.cos(a) * 70,
      vy: Math.sin(a) * 70,
      life: 0,
      maxLife: 0.25,
      size: 3,
      color,
      kind: 'dot',
      rotation: 0,
      spin: 0,
    });
  }
}

export function updateFloatTexts(list: FloatText[], dt: number): FloatText[] {
  for (const f of list) {
    f.life += dt;
    f.y += f.vy * dt;
    f.vy *= 0.98;
  }
  return list.filter((f) => f.life < f.maxLife);
}

export function updateImpacts(list: ImpactFlash[], dt: number): ImpactFlash[] {
  for (const f of list) f.life += dt;
  return list.filter((f) => f.life < f.maxLife);
}

export function updateComboBanners(list: ComboBanner[], dt: number): ComboBanner[] {
  for (const b of list) b.life += dt;
  return list.filter((b) => b.life < b.maxLife);
}

export function updateFxParticles(list: FxParticle[], dt: number): FxParticle[] {
  for (const p of list) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 380 * dt;
    p.vx *= 0.98;
    p.life += dt;
    p.rotation += p.spin * dt;
  }
  return list.filter((p) => p.life < p.maxLife);
}

export function drawFloatTexts(ctx: CanvasRenderingContext2D, list: FloatText[]): void {
  for (const f of list) {
    const t = f.life / f.maxLife;
    const alpha = 1 - t * t;
    const scale = f.scale * (1 + (1 - t) * 0.3);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(f.x, f.y);
    ctx.scale(scale, scale);
    ctx.font = '700 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,30,60,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
}

export function drawComboBanners(ctx: CanvasRenderingContext2D, w: number, list: ComboBanner[]): void {
  for (const b of list) {
    const t = b.life / b.maxLife;
    const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;
    const pulse = 1 + Math.sin(b.life * 12) * 0.04;
    const scale = (0.6 + Math.min(1, b.life * 4) * 0.4) * pulse;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, 120);
    ctx.scale(scale, scale);
    const isFire = b.level >= 5;
    ctx.font = `800 ${isFire ? 28 : 24}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = isFire ? 'rgba(255,120,40,0.8)' : 'rgba(94,232,154,0.6)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(0,30,60,0.6)';
    ctx.lineWidth = 4;
    ctx.strokeText(b.text, 0, 0);
    const grad = ctx.createLinearGradient(-80, -10, 80, 10);
    grad.addColorStop(0, isFire ? '#ffd54f' : '#5ee89a');
    grad.addColorStop(1, isFire ? '#ff6b35' : '#1f74e0');
    ctx.fillStyle = grad;
    ctx.fillText(b.text, 0, 0);
    ctx.restore();
  }
}

export function drawImpacts(ctx: CanvasRenderingContext2D, list: ImpactFlash[]): void {
  for (const f of list) {
    const t = f.life / f.maxLife;
    const alpha = 1 - t;
    const r = 8 + t * 18;
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, f.color);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawFxParticles(ctx: CanvasRenderingContext2D, list: FxParticle[]): void {
  for (const p of list) {
    const t = 1 - p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = t;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    if (p.kind === 'star') {
      drawStar(ctx, 0, 0, p.size * t, p.color);
    } else if (p.kind === 'sparkle') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, p.size * t * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-p.size * t, 0);
      ctx.lineTo(p.size * t, 0);
      ctx.moveTo(0, -p.size * t);
      ctx.lineTo(0, p.size * t);
      ctx.stroke();
    } else if (p.kind === 'glow') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * t);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * t, 0, Math.PI * 2);
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

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}
