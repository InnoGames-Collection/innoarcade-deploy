// Pooled 2D particle system. Particles are recycled from a fixed-capacity ring
// so steady emission produces zero garbage. Respects the reduced-motion and
// graphics-quality settings (callers pass a density multiplier).

export interface ParticleSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // seconds
  size: number;
  color: string;
  gravity?: number; // px/s^2 applied to vy
  drag?: number; // velocity retained per second (1 = none)
  shrink?: boolean; // size fades to 0 over life
  fade?: boolean; // alpha fades to 0 over life
  glow?: boolean; // additive blend for sparks/fire
}

interface Particle extends Required<ParticleSpec> {
  age: number;
  size0: number;
  alive: boolean;
}

export class Particles {
  private pool: Particle[] = [];
  private cursor = 0;

  constructor(capacity = 400) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 0, size0: 0, color: '#fff',
        gravity: 0, drag: 1, shrink: true, fade: true, glow: false, age: 0, alive: false,
      });
    }
  }

  emit(spec: ParticleSpec): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.x = spec.x; p.y = spec.y; p.vx = spec.vx; p.vy = spec.vy;
    p.life = spec.life; p.age = 0; p.size = spec.size; p.size0 = spec.size;
    p.color = spec.color;
    p.gravity = spec.gravity ?? 0;
    p.drag = spec.drag ?? 1;
    p.shrink = spec.shrink ?? true;
    p.fade = spec.fade ?? true;
    p.glow = spec.glow ?? false;
    p.alive = true;
  }

  // Radial burst — `count` particles thrown outward at random angles/speeds.
  burst(
    x: number, y: number, count: number, colors: string[],
    opts: { speed?: number; life?: number; size?: number; gravity?: number; glow?: boolean } = {},
  ): void {
    const speed = opts.speed ?? 180;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: (opts.life ?? 0.6) * (0.7 + Math.random() * 0.6),
        size: (opts.size ?? 4) * (0.6 + Math.random() * 0.8),
        color: colors[(Math.random() * colors.length) | 0],
        gravity: opts.gravity ?? 0,
        drag: 0.86,
        glow: opts.glow ?? false,
      });
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; continue; }
      p.vy += p.gravity * dt;
      if (p.drag !== 1) {
        const d = p.drag ** dt;
        p.vx *= d; p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.shrink) p.size = p.size0 * (1 - p.age / p.life);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    let glowing = false;
    for (const p of this.pool) {
      if (!p.alive) continue;
      if (p.glow !== glowing) {
        ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
        glowing = p.glow;
      }
      ctx.globalAlpha = p.fade ? Math.max(0, 1 - p.age / p.life) : 1;
      ctx.fillStyle = p.color;
      const s = Math.max(p.size, 0.5);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
  }
}
