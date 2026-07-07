// Shared screen juice for new arcade games — particles, shake, flash overlays.
// Pattern mirrors stable titles (bubble-pop, sky-hopper) without editing those games.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const MAX_PARTICLES = 96;

export class Juice {
  particles: Particle[] = [];
  screenShake = 0;
  flash = 0;
  flashColor = 'rgba(255,255,255,0.35)';

  burst(
    x: number,
    y: number,
    color: string,
    count = 12,
    spread = 160,
    size = 4,
  ): void {
    const room = Math.max(0, MAX_PARTICLES - this.particles.length);
    const n = Math.min(count, room);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const speed = spread * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
        size: size * (0.6 + Math.random() * 0.8),
        color,
      });
    }
  }

  shake(amount = 0.25): void {
    this.screenShake = Math.max(this.screenShake, amount);
  }

  flashOverlay(color: string, amount = 0.35): void {
    this.flashColor = color;
    this.flash = Math.max(this.flash, amount);
  }

  update(dt: number): void {
    this.screenShake = Math.max(0, this.screenShake - dt * 8);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.life += dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
  }

  applyShake(ctx: CanvasRenderingContext2D): void {
    if (this.screenShake <= 0) return;
    const s = this.screenShake * 3;
    ctx.translate(s * (Math.random() - 0.5), s * (Math.random() - 0.5));
  }

  drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = 1 - p.life / p.maxLife;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFlash(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.flash;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
