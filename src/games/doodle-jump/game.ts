import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';

export const W = 480;
export const H = 720;

interface Platform {
  x: number;
  y: number;
  w: number;
  broken: boolean;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class DoodleJump {
  state: GameState = 'menu';
  score = 0;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private px = W / 2;
  private py = H - 120;
  private vx = 0;
  private vy = 0;
  private camY = 0;
  private platforms: Platform[] = [];
  private rnd = mulberry32(42);
  private maxHeight = 0;

  start(): void {
    this.score = 0;
    this.maxHeight = 0;
    this.px = W / 2;
    this.py = H - 120;
    this.vx = 0;
    this.vy = -420;
    this.camY = 0;
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.platforms = [];
    for (let i = 0; i < 12; i++) this.addPlatform(H - 80 - i * 95);
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (a === 'left') this.vx = -260;
    else if (a === 'right') this.vx = 260;
    else if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  releaseDir(): void {
    this.vx = 0;
  }

  private addPlatform(y: number): void {
    this.platforms.push({
      x: 40 + this.rnd() * (W - 120),
      y,
      w: 70 + this.rnd() * 40,
      broken: this.rnd() < 0.12 && y < H - 200,
    });
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.vy += 980 * dt;
    this.px += this.vx * dt;
    this.py += this.vy * dt;
    if (this.px < 12) this.px = W - 12;
    if (this.px > W - 12) this.px = 12;

    const feet = this.py + 18;
    if (this.vy > 0) {
      for (const p of this.platforms) {
        if (p.broken) continue;
        if (feet >= p.y && feet <= p.y + 14 && this.px > p.x && this.px < p.x + p.w) {
          this.vy = -520;
          this.py = p.y - 18;
          if (p.broken) p.broken = true;
          sfx.click();
          break;
        }
      }
    }

    const height = Math.max(0, Math.floor((H - 120 - this.py + this.camY) / 8));
    if (height > this.maxHeight) {
      this.maxHeight = height;
      this.score = this.maxHeight;
    }

    if (this.py < H * 0.45) {
      const shift = H * 0.45 - this.py;
      this.py += shift;
      this.camY += shift;
      for (const p of this.platforms) p.y += shift;
      while (this.platforms[this.platforms.length - 1].y > 60) {
        const top = this.platforms[this.platforms.length - 1].y;
        this.addPlatform(top - (85 + this.rnd() * 35));
      }
    }

    this.platforms = this.platforms.filter((p) => p.y < H + 40);
    if (this.py > H + 60) this.gameOver();
  }

  private gameOver(): void {
    this.setState('over');
    const record = this.score > this.best;
    if (record) this.best = this.score;
    sfx.slide();
    this.onGameOver(this.score, record);
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#87CEEB');
    g.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const p of this.platforms) {
      ctx.fillStyle = p.broken ? '#8B4513' : '#2ecc71';
      ctx.fillRect(p.x, p.y, p.w, 12);
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(p.x, p.y, p.w, 4);
    }

    ctx.fillStyle = '#6c5ce7';
    ctx.beginPath();
    ctx.ellipse(this.px, this.py, 16, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.px - 5, this.py - 6, 4, 0, Math.PI * 2);
    ctx.arc(this.px + 5, this.py - 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(this.px - 5, this.py - 6, 2, 0, Math.PI * 2);
    ctx.arc(this.px + 5, this.py - 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
