import { BALL_R, CX } from './constants';

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

const MAX_TRAIL = 18;

export class BallTrail {
  private points: TrailPoint[] = [];

  push(screenY: number): void {
    this.points.push({ x: CX, y: screenY, life: 1 });
    if (this.points.length > MAX_TRAIL) this.points.shift();
  }

  update(dt: number): void {
    for (const p of this.points) p.life -= dt * 2.8;
    this.points = this.points.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, color: string): void {
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const t = p.life * (i / this.points.length);
      ctx.globalAlpha = t * 0.35;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R * (0.35 + t * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.points.length = 0;
  }
}

export function drawSquashBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  squash: number,
  color: string,
  fever: boolean,
): void {
  const sy = 1 + (1 - squash) * 0.22;
  const sx = 1 - (1 - squash) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  if (fever) {
    ctx.shadowColor = 'rgba(255,213,79,0.85)';
    ctx.shadowBlur = 16;
  } else {
    ctx.shadowColor = 'rgba(30,136,229,0.45)';
    ctx.shadowBlur = 10;
  }
  const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, shade(color, -30));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.28, r * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
