// Bubble Pop — pointer-aim bubble shooter with match-3 clears and hub theme.

import { sfx } from '../../engine/audio';
import { getHighScore, setHighScore } from '../../engine/storage';

export const W = 480;
export const H = 720;

const BUBBLE_R = 16;
const LAUNCH_SPEED = 520;
const CANNON_X = W / 2;
const CANNON_Y = H - 72;
const DANGER_Y = CANNON_Y - 36;

const COLORS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#95e1d3', '#c084fc'] as const;
type BubbleColor = typeof COLORS[number];

interface Bubble {
  x: number;
  y: number;
  color: BubbleColor;
  popping: boolean;
  popTime: number;
  falling: boolean;
  vy: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

interface Flight {
  x: number; y: number; vx: number; vy: number; color: BubbleColor;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'gameOver';

export class BubblePop {
  state: GameState = 'menu';
  score = 0;
  best = getHighScore('bubble-pop');

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private time = 0;
  private bubbles: Bubble[] = [];
  private particles: Particle[] = [];
  private screenShake = 0;
  private aimAngle = -Math.PI / 2;
  private aimActive = false;
  private nextColor: BubbleColor = this.randomColor();
  private flight: Flight | null = null;

  start(): void {
    this.score = 0;
    this.time = 0;
    this.bubbles = [];
    this.particles = [];
    this.screenShake = 0;
    this.aimAngle = -Math.PI / 2;
    this.aimActive = false;
    this.nextColor = this.randomColor();
    this.flight = null;
    this.buildGrid();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  /** Aim cannon toward canvas point. */
  setAim(x: number, y: number): void {
    if (this.state !== 'playing' || this.flight) return;
    const dx = x - CANNON_X;
    const dy = y - CANNON_Y;
    if (dy > -12) return;
    let angle = Math.atan2(dy, dx);
    angle = Math.max(-Math.PI + 0.15, Math.min(-0.15, angle));
    this.aimAngle = angle;
    this.aimActive = true;
  }

  clearAim(): void {
    this.aimActive = false;
  }

  fire(): void {
    if (this.state !== 'playing' || this.flight) return;
    this.flight = {
      x: CANNON_X,
      y: CANNON_Y,
      vx: Math.cos(this.aimAngle) * LAUNCH_SPEED,
      vy: Math.sin(this.aimAngle) * LAUNCH_SPEED,
      color: this.nextColor,
    };
    this.nextColor = this.randomColor();
    this.aimActive = false;
    sfx.click();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.state !== 'playing') return;

    this.screenShake = Math.max(0, this.screenShake - dt * 8);

    if (this.flight) {
      const f = this.flight;
      const steps = 3;
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        f.x += f.vx * sdt;
        f.y += f.vy * sdt;
        if (f.x < BUBBLE_R) { f.x = BUBBLE_R; f.vx = Math.abs(f.vx); }
        if (f.x > W - BUBBLE_R) { f.x = W - BUBBLE_R; f.vx = -Math.abs(f.vx); }
        if (f.y < BUBBLE_R) {
          this.stickBubble(f.x, BUBBLE_R, f.color);
          this.flight = null;
          break;
        }
        const hit = this.findCollision(f.x, f.y);
        if (hit) {
          this.stickTo(hit, f);
          this.flight = null;
          break;
        }
      }
    }

    for (const b of this.bubbles) {
      if (b.falling) {
        b.y += b.vy * dt;
        b.vy += 640 * dt;
      }
      if (b.popping) b.popTime += dt;
    }

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life += dt;
    }

    this.bubbles = this.bubbles.filter((b) => !b.popping || b.popTime < 0.22);
    this.bubbles = this.bubbles.filter((b) => !b.falling || b.y < H + 60);
    this.particles = this.particles.filter((p) => p.life < p.maxLife);

    const lowest = this.bubbles.reduce((m, b) => (!b.falling && !b.popping ? Math.max(m, b.y) : m), 0);
    if (lowest >= DANGER_Y) this.endRun();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const shake = this.screenShake * 3;
    ctx.save();
    ctx.translate(shake * (Math.random() - 0.5), shake * (Math.random() - 0.5));

    this.drawBackdrop(ctx);
    this.drawGridBubbles(ctx);

    if (this.flight) this.drawBubble(ctx, this.flight.x, this.flight.y, this.flight.color, 1);

    this.drawCannon(ctx);
    if (this.aimActive && !this.flight) this.drawAimGuide(ctx);
    this.drawParticles(ctx);

    ctx.restore();
  }

  private buildGrid(): void {
    const rows = 5;
    const cols = 8;
    const spacing = BUBBLE_R * 2 + 2;
    const startX = (W - (cols - 1) * spacing) / 2;
    const startY = 88;

    for (let row = 0; row < rows; row++) {
      const offset = row % 2 === 1 ? spacing / 2 : 0;
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacing + offset;
        const y = startY + row * (spacing * 0.86);
        if (x > BUBBLE_R && x < W - BUBBLE_R) {
          this.bubbles.push({
            x, y, color: this.randomColor(),
            popping: false, popTime: 0, falling: false, vy: 0,
          });
        }
      }
    }
  }

  private stickBubble(x: number, y: number, color: BubbleColor): void {
    const b: Bubble = { x, y, color, popping: false, popTime: 0, falling: false, vy: 0 };
    this.bubbles.push(b);
    this.resolveMatches(b);
  }

  private stickTo(hit: Bubble, f: Flight): void {
    const dx = f.x - hit.x;
    const dy = f.y - hit.y;
    const len = Math.hypot(dx, dy) || 1;
    const x = hit.x + (dx / len) * (BUBBLE_R * 2);
    const y = hit.y + (dy / len) * (BUBBLE_R * 2);
    this.stickBubble(x, y, f.color);
  }

  private findCollision(x: number, y: number): Bubble | null {
    for (const b of this.bubbles) {
      if (b.popping || b.falling) continue;
      if (Math.hypot(x - b.x, y - b.y) < BUBBLE_R * 1.85) return b;
    }
    return null;
  }

  private resolveMatches(origin: Bubble): void {
    const group = this.floodSameColor(origin);
    if (group.length < 3) return;

    const mult = 1 + Math.max(0, group.length - 3) * 0.15;
    this.score += Math.round(group.length * 12 * mult);
    sfx.coin();
    this.screenShake = 0.2;

    for (const b of group) {
      b.popping = true;
      b.popTime = 0;
      this.burst(b.x, b.y, b.color);
    }

    window.setTimeout(() => {
      for (const b of group) {
        const i = this.bubbles.indexOf(b);
        if (i >= 0) this.bubbles.splice(i, 1);
      }
      this.dropFloaters();
    }, 140);
  }

  private floodSameColor(start: Bubble): Bubble[] {
    const out: Bubble[] = [];
    const seen = new Set<Bubble>();
    const q = [start];
    while (q.length) {
      const cur = q.pop()!;
      if (seen.has(cur) || cur.popping || cur.falling) continue;
      seen.add(cur);
      if (cur.color !== start.color) continue;
      out.push(cur);
      for (const other of this.bubbles) {
        if (!seen.has(other) && !other.popping && !other.falling &&
          Math.hypot(cur.x - other.x, cur.y - other.y) < BUBBLE_R * 2.15) {
          q.push(other);
        }
      }
    }
    return out;
  }

  private dropFloaters(): void {
    for (const b of this.bubbles) {
      if (b.popping || b.falling) continue;
      const supported = this.bubbles.some((other) =>
        !other.popping && !other.falling && other !== b &&
        Math.hypot(b.x - other.x, b.y - other.y) < BUBBLE_R * 2.15 &&
        other.y > b.y + 4,
      );
      if (!supported) {
        b.falling = true;
        b.vy = 40;
        this.score += 5;
      }
    }
  }

  private endRun(): void {
    const record = this.score > this.best;
    if (record) {
      setHighScore('bubble-pop', this.score);
      this.best = this.score;
    }
    this.setState('gameOver');
    this.onGameOver(this.score, record);
  }

  private burst(x: number, y: number, color: BubbleColor): void {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * 110,
        vy: Math.sin(angle) * 110,
        life: 0, maxLife: 0.45,
        size: 4, color,
      });
    }
  }

  private randomColor(): BubbleColor {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  private setState(next: GameState): void {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange(next);
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    const sea = ctx.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#1b6b8f');
    sea.addColorStop(0.55, '#14506e');
    sea.addColorStop(1, '#0d3550');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 4; i++) {
      const rx = 70 + i * 120;
      const sway = Math.sin(this.time * 0.4 + i * 1.7) * 22;
      const ray = ctx.createLinearGradient(rx, 0, rx + sway, H);
      ray.addColorStop(0, 'rgba(180, 240, 255, 0.14)');
      ray.addColorStop(1, 'rgba(180, 240, 255, 0)');
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(rx - 16, 0);
      ctx.lineTo(rx + 16, 0);
      ctx.lineTo(rx + sway + 42, H);
      ctx.lineTo(rx + sway - 42, H);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(226, 86, 58, 0.45)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(W, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawGridBubbles(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bubbles) {
      const scale = b.popping ? Math.max(0, 1 - b.popTime / 0.22) : 1;
      this.drawBubble(ctx, b.x, b.y, b.color, scale);
    }
  }

  private drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale: number): void {
    const r = BUBBLE_R * scale;
    if (r <= 0) return;
    const g = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.35, color);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawCannon(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#4f9e16';
    ctx.beginPath();
    ctx.arc(CANNON_X, CANNON_Y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(CANNON_X, CANNON_Y);
    ctx.lineTo(
      CANNON_X + Math.cos(this.aimAngle) * 42,
      CANNON_Y + Math.sin(this.aimAngle) * 42,
    );
    ctx.stroke();

    this.drawBubble(ctx, CANNON_X - 28, CANNON_Y + 4, this.nextColor, 0.85);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', CANNON_X - 28, CANNON_Y + 30);
  }

  private drawAimGuide(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(79, 158, 22, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(CANNON_X, CANNON_Y);
    let x = CANNON_X;
    let y = CANNON_Y;
    let vx = Math.cos(this.aimAngle);
    let vy = Math.sin(this.aimAngle);
    for (let i = 0; i < 28; i++) {
      x += vx * 18;
      y += vy * 18;
      if (x < BUBBLE_R) { x = BUBBLE_R; vx = Math.abs(vx); }
      if (x > W - BUBBLE_R) { x = W - BUBBLE_R; vx = -Math.abs(vx); }
      ctx.lineTo(x, y);
      if (y < 40) break;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const a = 1 - p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
