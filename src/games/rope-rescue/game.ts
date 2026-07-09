import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { drawGemRect, drawPersonOrb } from '../_shared/premiumCanvas';

export const W = 480;
export const H = 720;

interface Point { x: number; y: number; }

interface Spike {
  x: number;
  y: number;
  w: number;
}

const LEVELS = 3;
const SWING_BTN = { x: W / 2 - 70, y: H - 56, w: 140, h: 44 };

export type GameState = 'menu' | 'playing' | 'paused' | 'over';
type Phase = 'draw' | 'swing' | 'result';

export class RopeRescue {
  state: GameState = 'menu';
  score = 0;
  level = 1;
  best = 0;
  hint = '';

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private phase: Phase = 'draw';
  private rope: Point[] = [];
  private drawing = false;
  private person = { x: 80, y: 180 };
  private safe = { x: 340, y: 520, w: 90, h: 50 };
  private spikes: Spike[] = [];
  private swingT = 0;
  private swingPos = { x: 80, y: 180 };
  private resultT = 0;
  private swingWon = false;

  start(): void {
    this.score = 0;
    this.level = 1;
    this.hint = '';
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
    this.swingWon = false;
    this.hint = 'Draw from the person to the green zone, then tap SWING';
    this.person = { x: 70, y: 150 + this.level * 15 };
    this.safe = { x: 320 - this.level * 10, y: 510, w: 100, h: 55 };
    this.spikes = [
      { x: 160, y: 460, w: 120 },
      { x: 200, y: 400, w: 80 },
    ];
    this.swingT = 0;
    this.swingPos = { ...this.person };
    this.resultT = 0;
  }

  pointerDown(x: number, y: number): void {
    if (this.state !== 'playing' || this.phase !== 'draw') return;
    if (this.hitSwingBtn(x, y)) {
      this.tapSwing();
      return;
    }
    this.drawing = true;
    const start = Math.hypot(x - this.person.x, y - this.person.y) < 40
      ? { ...this.person }
      : { x, y };
    this.rope = [start];
    this.hint = 'Draw to the green safe zone…';
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
    if (this.state !== 'playing' || this.phase !== 'draw') return;
    if (this.rope.length < 3) {
      this.hint = 'Draw a longer rope first';
      sfx.slide();
      return;
    }
    const end = this.rope[this.rope.length - 1];
    const nearSafe = end.x >= this.safe.x - 30 && end.x <= this.safe.x + this.safe.w + 30
      && end.y >= this.safe.y - 40 && end.y <= this.safe.y + this.safe.h + 40;
    if (!nearSafe) {
      this.hint = 'End your rope in the green safe zone';
      sfx.slide();
      return;
    }
    if (this.ropeHitsSpike()) {
      this.hint = 'Rope crosses spikes — try a different path';
      sfx.slide();
      return;
    }
    this.phase = 'swing';
    this.swingT = 0;
    this.hint = '';
    sfx.click();
  }

  handleAction(a: Action): void {
    if (a === 'tap' && this.phase === 'draw') this.tapSwing();
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  private hitSwingBtn(x: number, y: number): boolean {
    return x >= SWING_BTN.x && x <= SWING_BTN.x + SWING_BTN.w
      && y >= SWING_BTN.y && y <= SWING_BTN.y + SWING_BTN.h;
  }

  private ropeHitsSpike(): boolean {
    for (let i = 1; i < this.rope.length; i++) {
      const a = this.rope[i - 1];
      const b = this.rope[i];
      for (const s of this.spikes) {
        if (this.segRectHit(a, b, s.x, s.y, s.w, 18)) return true;
      }
    }
    return false;
  }

  private segRectHit(a: Point, b: Point, rx: number, ry: number, rw: number, rh: number): boolean {
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
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
      const t = Math.min(1, this.swingT / 1.6);
      this.swingPos = this.pointOnRope(t);
      if (t >= 1) {
        const inSafe = this.swingPos.x >= this.safe.x && this.swingPos.x <= this.safe.x + this.safe.w
          && this.swingPos.y >= this.safe.y && this.swingPos.y <= this.safe.y + this.safe.h;
        this.swingWon = inSafe;
        this.phase = 'result';
        this.resultT = 0;
        if (inSafe) {
          this.score += 80 + this.level * 20;
          sfx.coin();
        } else {
          this.hint = 'Missed the safe zone!';
          sfx.slide();
          this.endSession(false);
        }
      }
    }

    if (this.phase === 'result') {
      this.resultT += dt;
      if (this.resultT > 1.2) {
        if (this.swingWon && this.level >= LEVELS) {
          this.endSession(true);
        } else if (this.swingWon) {
          this.level++;
          this.resetLevel();
        }
      }
    }
  }

  private endSession(victory: boolean): void {
    this.setState('over');
    const record = this.score > this.best;
    if (record) this.best = this.score;
    if (victory) sfx.coin();
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

    drawGemRect(ctx, this.safe.x, this.safe.y, this.safe.w, this.safe.h, '#2ecc71', 8);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('SAFE', this.safe.x + this.safe.w / 2, this.safe.y + this.safe.h / 2 + 4);

    ctx.fillStyle = '#e74c3c';
    for (const s of this.spikes) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + 18);
      for (let i = 0; i <= s.w; i += 20) {
        ctx.lineTo(s.x + i + 10, s.y);
        ctx.lineTo(s.x + i + 20, s.y + 18);
      }
      ctx.fill();
    }

    if (this.rope.length > 1) {
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.rope[0].x, this.rope[0].y);
      for (let i = 1; i < this.rope.length; i++) ctx.lineTo(this.rope[i].x, this.rope[i].y);
      ctx.stroke();
    }

    drawPersonOrb(ctx, this.person.x, this.person.y, 18, '#3498db', 'YOU');

    if (this.phase === 'swing' || this.phase === 'result') {
      drawPersonOrb(ctx, this.swingPos.x, this.swingPos.y, 14, '#e67e22');
    }

    if (this.phase === 'draw') {
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(SWING_BTN.x, SWING_BTN.y, SWING_BTN.w, SWING_BTN.h);
      ctx.fillStyle = '#1a252f';
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('SWING', W / 2, SWING_BTN.y + 28);
    }

    if (this.hint) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(this.hint, W / 2, H - 90);
    }
  }
}
