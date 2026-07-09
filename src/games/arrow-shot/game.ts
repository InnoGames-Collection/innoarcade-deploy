import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import { drawBullseye } from '../_shared/premiumCanvas';

export const W = 480;
export const H = 720;

interface Target {
  x: number;
  y: number;
  r: number;
  pts: number;
  vx: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class ArrowShot {
  state: GameState = 'menu';
  score = 0;
  arrows = 12;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private targets: Target[] = [];
  private aiming = false;
  private aimX = W / 2;
  private aimY = H - 80;
  private pull = 0;
  private arrow: { x: number; y: number; vx: number; vy: number; active: boolean } | null = null;
  private rnd = mulberry32(3);
  private wind = 0;

  start(): void {
    this.score = 0;
    this.arrows = 12;
    this.targets = [];
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.wind = (this.rnd() - 0.5) * 80;
    this.spawnTargets();
    this.arrow = null;
    this.aiming = false;
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  pointerDown(x: number, y: number): void {
    if (this.state !== 'playing' || this.arrow?.active) return;
    this.aiming = true;
    this.aimX = x;
    this.aimY = y;
    this.pull = 0;
  }

  pointerMove(x: number, y: number): void {
    if (!this.aiming) return;
    this.aimX = x;
    this.aimY = y;
    this.pull = Math.min(120, Math.hypot(x - W / 2, y - (H - 60)));
  }

  pointerUp(): void {
    if (!this.aiming || this.arrows <= 0) return;
    this.aiming = false;
    const dx = W / 2 - this.aimX;
    const dy = (H - 60) - this.aimY;
    const len = Math.hypot(dx, dy) || 1;
    const power = this.pull * 6;
    this.arrow = {
      x: W / 2,
      y: H - 60,
      vx: (dx / len) * power,
      vy: (dy / len) * power,
      active: true,
    };
    this.arrows--;
    sfx.click();
  }

  handleAction(a: Action): void {
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  private spawnTargets(): void {
    while (this.targets.length < 4) {
      this.targets.push({
        x: 60 + this.rnd() * (W - 120),
        y: 80 + this.rnd() * 320,
        r: 18 + this.rnd() * 16,
        pts: 20 + Math.floor(this.rnd() * 40),
        vx: (this.rnd() - 0.5) * 40,
      });
    }
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;

    for (const t of this.targets) {
      t.x += t.vx * dt;
      if (t.x < t.r + 20 || t.x > W - t.r - 20) t.vx *= -1;
    }

    if (!this.arrow?.active) {
      if (this.arrows <= 0) this.gameOver();
      return;
    }

    const a = this.arrow;
    a.vy += 420 * dt;
    a.vx += this.wind * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (Math.hypot(a.x - t.x, a.y - t.y) < t.r) {
        this.score += t.pts;
        this.targets.splice(i, 1);
        sfx.coin();
        this.spawnTargets();
        this.wind = (this.rnd() - 0.5) * 100;
        a.active = false;
        this.arrow = null;
        if (this.arrows <= 0) this.gameOver();
        return;
      }
    }

    if (a.y > H + 20 || a.x < -20 || a.x > W + 20) {
      a.active = false;
      this.arrow = null;
      sfx.slide();
      if (this.arrows <= 0) this.gameOver();
    }
  }

  private gameOver(): void {
    this.setState('over');
    const record = this.score > this.best;
    if (record) this.best = this.score;
    this.onGameOver(this.score, record);
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(0, H - 40, W, 40);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Wind ${this.wind > 0 ? '→' : '←'} ${Math.abs(Math.round(this.wind))}`, W / 2, 24);

    for (const t of this.targets) {
      drawBullseye(ctx, t.x, t.y, t.r);
    }

    ctx.fillStyle = '#5D4037';
    ctx.fillRect(W / 2 - 8, H - 60, 16, 50);

    if (this.aiming) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2, H - 60);
      ctx.lineTo(this.aimX, this.aimY);
      ctx.stroke();
    }

    if (this.arrow?.active) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.arrow.x, this.arrow.y);
      ctx.lineTo(this.arrow.x - this.arrow.vx * 0.04, this.arrow.y - this.arrow.vy * 0.04);
      ctx.stroke();
    }
  }
}
