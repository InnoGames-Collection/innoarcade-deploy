import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

const SEG = 56;
const SPEED = 220;

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class ZigZag {
  state: GameState = 'menu';
  score = 0;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private bx = W / 2;
  private by = H - 180;
  private dir = 1; // 1 = right-down, -1 = left-down
  private path: { x: number; y: number }[] = [];
  private camY = 0;
  private dist = 0;

  start(): void {
    this.score = 0;
    this.dist = 0;
    this.bx = W / 2;
    this.by = H - 180;
    this.dir = 1;
    this.camY = 0;
    this.path = [{ x: W / 2, y: H - 100 }];
    for (let i = 1; i < 40; i++) {
      const prev = this.path[i - 1];
      const turn = i % 2 === 0 ? 1 : -1;
      this.path.push({ x: prev.x + turn * SEG, y: prev.y - SEG });
    }
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
      this.dir *= -1;
      sfx.click();
    }
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    const dx = this.dir * SPEED * dt * 0.7;
    const dy = -SPEED * dt * 0.7;
    this.bx += dx;
    this.by += dy;
    this.dist += SPEED * dt;
    this.score = Math.floor(this.dist / 10);

    const onPath = this.path.some((p) => Math.hypot(this.bx - p.x, this.by - p.y) < SEG * 0.55);
    if (!onPath) {
      this.gameOver();
      return;
    }

    if (this.by < H * 0.5) {
      const shift = H * 0.5 - this.by;
      this.by += shift;
      this.camY += shift;
      for (const p of this.path) p.y += shift;
      const last = this.path[this.path.length - 1];
      const turn = this.path.length % 2 === 0 ? 1 : -1;
      this.path.push({ x: last.x + turn * SEG, y: last.y - SEG });
      if (this.path.length > 60) this.path.shift();
    }

    if (this.bx < 20 || this.bx > W - 20) this.gameOver();
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
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = SEG * 0.9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < this.path.length; i++) {
      const p = this.path[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(this.bx, this.by, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.bx - 4, this.by - 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
