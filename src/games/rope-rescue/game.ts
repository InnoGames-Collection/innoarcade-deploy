import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

interface Point { x: number; y: number; }

interface Spike {
  x: number;
  y: number;
  w: number;
}

const LEVELS = 3;

export type GameState = 'menu' | 'playing' | 'paused' | 'over';
type Phase = 'draw' | 'swing' | 'result';

export class RopeRescue {
  state: GameState = 'menu';
  score = 0;
  level = 1;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private phase: Phase = 'draw';
  private rope: Point[] = [];
  private drawing = false;
  private person = { x: 80, y: 180 };
  private anchor = { x: 400, y: 120 };
  private safe = { x: 400, y: 520, w: 60, h: 40 };
  private spikes: Spike[] = [];
  private swingT = 0;
  private swingPos = { x: 80, y: 180 };
  private resultT = 0;

  start(): void {
    this.score = 0;
    this.level = 1;
    this.resetLevel();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  private resetLevel(): void {
    this.phase = 'draw';
    this.rope = [];
    this.drawing = false;
    this.person = { x: 80, y: 160 + this.level * 20 };
    this.anchor = { x: 400, y: 100 };
    this.safe = { x: 380, y: 500, w: 70, h: 44 };
    this.spikes = [
      { x: 120, y: 420, w: 240 },
      { x: 60, y: 360, w: 180 },
    ];
    this.swingT = 0;
    this.swingPos = { ...this.person };
    this.resultT = 0;
  }

  pointerDown(x: number, y: number): void {
    if (this.state !== 'playing' || this.phase !== 'draw') return;
    this.drawing = true;
    this.rope = [{ x, y }];
  }

  pointerMove(x: number, y: number): void {
    if (!this.drawing || this.phase !== 'draw') return;
    const last = this.rope[this.rope.length - 1];
    if (Math.hypot(x - last.x, y - last.y) > 8) this.rope.push({ x, y });
  }

  pointerUp(): void {
    this.drawing = false;
  }

  tapSwing(): void {
    if (this.state !== 'playing' || this.phase !== 'draw' || this.rope.length < 4) return;
    if (this.ropeHitsSpike()) return;
    this.phase = 'swing';
    this.swingT = 0;
    sfx.click();
  }

  handleAction(a: Action): void {
    if (a === 'tap' && this.phase === 'draw') this.tapSwing();
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  private ropeHitsSpike(): boolean {
    for (let i = 1; i < this.rope.length; i++) {
      const a = this.rope[i - 1];
      const b = this.rope[i];
      for (const s of this.spikes) {
        if (this.segRectHit(a, b, s.x, s.y, s.w, 16)) return true;
      }
    }
    return false;
  }

  private segRectHit(a: Point, b: Point, rx: number, ry: number, rw: number, rh: number): boolean {
    const samples = 12;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return true;
    }
    return false;
  }

  private pointOnRope(t: number): Point {
    const total = this.rope.length - 1;
    const f = t * total;
    const i = Math.min(Math.floor(f), total - 1);
    const local = f - i;
    const a = this.rope[i];
    const b = this.rope[i + 1];
    return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;

    if (this.phase === 'swing') {
      this.swingT += dt;
      const t = Math.min(1, this.swingT / 1.8);
      this.swingPos = this.pointOnRope(t);
      if (t >= 1) {
        const inSafe = this.swingPos.x >= this.safe.x && this.swingPos.x <= this.safe.x + this.safe.w
          && this.swingPos.y >= this.safe.y && this.swingPos.y <= this.safe.y + this.safe.h;
        this.phase = 'result';
        this.resultT = 0;
        if (inSafe) {
          this.score += 80 + this.level * 20;
          sfx.coin();
        } else {
          sfx.slide();
          this.gameOver();
        }
      }
    }

    if (this.phase === 'result') {
      this.resultT += dt;
      if (this.resultT > 1.2) {
        if (this.level >= LEVELS) {
          this.gameOver();
        } else {
          this.level++;
          this.resetLevel();
        }
      }
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
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2c3e50');
    g.addColorStop(1, '#1a252f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#27ae60';
    ctx.fillRect(this.safe.x, this.safe.y, this.safe.w, this.safe.h);

    ctx.fillStyle = '#e74c3c';
    for (const s of this.spikes) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + 16);
      for (let i = 0; i <= s.w; i += 20) {
        ctx.lineTo(s.x + i + 10, s.y);
        ctx.lineTo(s.x + i + 20, s.y + 16);
      }
      ctx.fill();
    }

    ctx.fillStyle = '#8B7355';
    ctx.beginPath();
    ctx.arc(this.anchor.x, this.anchor.y, 10, 0, Math.PI * 2);
    ctx.fill();

    if (this.rope.length > 1) {
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.rope[0].x, this.rope[0].y);
      for (let i = 1; i < this.rope.length; i++) ctx.lineTo(this.rope[i].x, this.rope[i].y);
      ctx.stroke();
    }

    const p = this.phase === 'swing' || this.phase === 'result' ? this.swingPos : this.person;
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fill();

    if (this.phase === 'draw') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '16px system-ui';
      ctx.fillText('Draw rope → tap SWING', 120, H - 36);
    }
  }
}
