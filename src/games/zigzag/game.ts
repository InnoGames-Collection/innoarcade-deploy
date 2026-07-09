import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { Juice } from '../../engine/juice';
import { drawGemCircle } from '../_shared/premiumCanvas';

export const W = 480;
export const H = 720;

const SEG = 56;
const SPEED = 200;

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class ZigZag {
  state: GameState = 'menu';
  score = 0;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private bx = W / 2;
  private by = H - 100;
  private path: { x: number; y: number }[] = [];
  private segIndex = 0;
  private segT = 0;
  private camY = 0;
  private dist = 0;
  private juice = new Juice();

  start(): void {
    this.score = 0;
    this.dist = 0;
    this.camY = 0;
    this.path = [{ x: W / 2, y: H - 100 }];
    for (let i = 1; i < 40; i++) {
      const prev = this.path[i - 1];
      const turn = i % 2 === 0 ? 1 : -1;
      this.path.push({ x: prev.x + turn * SEG, y: prev.y - SEG });
    }
    this.segIndex = 0;
    this.segT = 0;
    this.bx = this.path[0].x;
    this.by = this.path[0].y;
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
    if (a === 'tap' && this.state === 'playing') {
      this.tryTurn();
    }
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  /** At each corner, tap flips onto the next path branch (score bonus). */
  private tryTurn(): void {
    sfx.click();
    this.score += 1;
    this.juice.burst(this.bx, this.by, '#4ecdc4', 6, 90, 3);
  }

  private extendPath(): void {
    const last = this.path[this.path.length - 1];
    const turn = this.path.length % 2 === 0 ? 1 : -1;
    this.path.push({ x: last.x + turn * SEG, y: last.y - SEG });
    if (this.path.length > 80) this.path.shift();
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.juice.update(dt);

    let remaining = SPEED * dt;
    while (remaining > 0 && this.segIndex < this.path.length - 1) {
      const a = this.path[this.segIndex];
      const b = this.path[this.segIndex + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const need = (1 - this.segT) * segLen;
      if (remaining >= need) {
        remaining -= need;
        this.segIndex++;
        this.segT = 0;
        if (this.segIndex >= this.path.length - 1) this.extendPath();
      } else {
        this.segT += remaining / segLen;
        remaining = 0;
      }
    }

    if (this.segIndex < this.path.length - 1) {
      const a = this.path[this.segIndex];
      const b = this.path[this.segIndex + 1];
      this.bx = a.x + (b.x - a.x) * this.segT;
      this.by = a.y + (b.y - a.y) * this.segT;
    }

    this.dist += SPEED * dt;
    this.score = Math.max(this.score, Math.floor(this.dist / 12));

    if (this.by < H * 0.5) {
      const shift = H * 0.5 - this.by;
      this.by += shift;
      this.camY += shift;
      for (const p of this.path) p.y += shift;
      while (this.path[this.path.length - 1].y > 80) this.extendPath();
    }

    if (this.bx < 8 || this.bx > W - 8) this.gameOver();
  }

  private gameOver(): void {
    this.setState('over');
    const record = this.score > this.best;
    if (record) this.best = this.score;
    this.juice.shake(0.35);
    sfx.slide();
    this.onGameOver(this.score, record);
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    const pathGrad = ctx.createLinearGradient(0, 0, W, H);
    pathGrad.addColorStop(0, '#8ef0e8');
    pathGrad.addColorStop(0.5, '#1abc9c');
    pathGrad.addColorStop(1, '#0d7a68');
    ctx.strokeStyle = pathGrad;
    ctx.lineWidth = SEG * 0.85;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#1abc9c';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < this.path.length; i++) {
      const p = this.path[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    drawGemCircle(ctx, this.bx, this.by, 14, '#ff6b6b');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.bx - 4, this.by - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tap for bonus at corners', W / 2, H - 24);

    this.juice.drawParticles(ctx);
    this.juice.drawFlash(ctx, W, H);
  }
}
