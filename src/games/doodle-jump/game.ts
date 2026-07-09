import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import { drawGemCircle, drawGemPlatform } from '../_shared/premiumCanvas';
import { Juice } from '../../engine/juice';

export const W = 480;
export const H = 720;

const PLAYER_H = 36;

interface Platform {
  x: number;
  y: number;
  w: number;
  crumbling: boolean;
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
  private juice = new Juice();

  start(): void {
    this.score = 0;
    this.camY = 0;
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.platforms = [];

    const startY = H - 72;
    this.platforms.push({ x: W / 2 - 55, y: startY, w: 110, crumbling: false });
    for (let i = 1; i < 14; i++) {
      this.addPlatform(startY - i * 92);
    }

    this.px = W / 2;
    this.py = startY - PLAYER_H;
    this.vx = 0;
    this.vy = 0;
    this.juice = new Juice();
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
      x: 30 + this.rnd() * (W - 130),
      y,
      w: 72 + this.rnd() * 36,
      crumbling: this.rnd() < 0.15 && y < H - 320,
    });
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.juice.update(dt);
    const prevFeet = this.py + PLAYER_H;
    this.vy += 900 * dt;
    this.px += this.vx * dt;
    this.py += this.vy * dt;
    if (this.px < 16) this.px = W - 16;
    if (this.px > W - 16) this.px = 16;

    if (this.vy > 0) {
      const feet = this.py + PLAYER_H;
      for (const p of this.platforms) {
        if (p.y > H + 50) continue;
        if (prevFeet <= p.y + 6 && feet >= p.y && feet <= p.y + 16
          && this.px + 10 > p.x && this.px - 10 < p.x + p.w) {
          this.vy = -480;
          this.py = p.y - PLAYER_H;
          this.juice.burst(this.px, p.y, p.crumbling ? '#8B4513' : '#2ecc71', 8, 100, 3);
          sfx.click();
          if (p.crumbling) p.y = H + 999;
          break;
        }
      }
    }

    if (this.py < H * 0.42) {
      const shift = H * 0.42 - this.py;
      this.py += shift;
      this.camY += shift;
      for (const p of this.platforms) p.y += shift;
      this.score = Math.floor(this.camY / 10);
      while (this.platforms[this.platforms.length - 1].y > 60) {
        const lastY = this.platforms[this.platforms.length - 1].y;
        this.addPlatform(lastY - (82 + this.rnd() * 30));
      }
    }

    this.platforms = this.platforms.filter((p) => p.y < H + 800);
    if (this.py > H + 80) this.gameOver();
  }

  private gameOver(): void {
    this.setState('over');
    const record = this.score > this.best;
    if (record) this.best = this.score;
    this.juice.shake(0.3);
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

    ctx.save();
    this.juice.applyShake(ctx);
    for (const p of this.platforms) {
      if (p.y > H + 40) continue;
      drawGemPlatform(ctx, p.x, p.y, p.w, 12, p.crumbling ? '#e67e22' : '#2ecc71');
    }

    drawGemCircle(ctx, this.px, this.py + 8, 16, '#6c5ce7');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.px - 5, this.py + 2, 4, 0, Math.PI * 2);
    ctx.arc(this.px + 5, this.py + 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(this.px - 5, this.py + 2, 2, 0, Math.PI * 2);
    ctx.arc(this.px + 5, this.py + 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.juice.drawParticles(ctx);
    this.juice.drawFlash(ctx, W, H);
  }
}
