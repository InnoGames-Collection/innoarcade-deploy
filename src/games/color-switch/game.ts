import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import { drawColorBlindGlyph } from '../_shared/colorBlind';
import { drawGemCircle } from '../_shared/premiumCanvas';

export const W = 480;
export const H = 720;

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'] as const;

interface Obstacle {
  y: number;
  rot: number;
  colorIdx: number;
  star?: boolean;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class ColorSwitch {
  state: GameState = 'menu';
  score = 0;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private bx = W / 2;
  private by = 140;
  private vy = 0;
  private colorIdx = 0;
  private obstacles: Obstacle[] = [];
  private rnd = mulberry32(11);
  private passed = 0;

  start(): void {
    this.score = 0;
    this.passed = 0;
    this.bx = W / 2;
    this.by = 140;
    this.vy = 0;
    this.colorIdx = 0;
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.obstacles = [];
    for (let i = 0; i < 12; i++) this.addObstacle(280 + i * 160);
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
      this.colorIdx = (this.colorIdx + 1) % COLORS.length;
      sfx.click();
    }
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  private addObstacle(y: number): void {
    this.obstacles.push({
      y,
      rot: this.rnd() * Math.PI * 2,
      colorIdx: Math.floor(this.rnd() * COLORS.length),
      star: this.rnd() < 0.35,
    });
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.vy += 620 * dt;
    this.by += this.vy * dt;

    for (const o of this.obstacles) {
      if (Math.abs(this.by - o.y) < 28 && Math.abs(this.bx - W / 2) < 90) {
        const seg = ((o.rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const ballAngle = -Math.PI / 2;
        const rel = ((ballAngle - seg) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const quadrant = Math.floor(rel / (Math.PI / 2));
        const obstacleColor = (o.colorIdx + quadrant) % COLORS.length;
        if (obstacleColor !== this.colorIdx) {
          this.gameOver();
          return;
        }
        if (this.by < o.y && this.vy > 0) {
          this.vy = -380;
          if (o.y > this.passed) {
            this.passed = o.y;
            this.score += o.star ? 5 : 1;
            sfx.coin();
          }
        }
      }
    }

    if (this.by > H + 40) this.gameOver();

    const top = this.obstacles[this.obstacles.length - 1]?.y ?? 0;
    if (top < H + 200) this.addObstacle(top + 160);
    this.obstacles = this.obstacles.filter((o) => o.y > -80);
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
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    for (const o of this.obstacles) {
      const cx = W / 2;
      const cy = o.y;
      const r = 78;
      for (let i = 0; i < 4; i++) {
        const segIdx = (o.colorIdx + i) % 4;
        ctx.fillStyle = COLORS[segIdx];
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, o.rot + i * Math.PI / 2, o.rot + (i + 1) * Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        const mid = o.rot + (i + 0.5) * Math.PI / 2;
        drawColorBlindGlyph(ctx, cx + Math.cos(mid) * (r * 0.62), cy + Math.sin(mid) * (r * 0.62), segIdx, 11);
      }
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fill();
      if (o.star) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 18px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', cx, cy);
      }
    }

    drawGemCircle(ctx, this.bx, this.by, 14, COLORS[this.colorIdx]);
    drawColorBlindGlyph(ctx, this.bx, this.by, this.colorIdx, 12);
  }
}
