// Stack Tower — one-tap precision stacking. Canvas arcade game.
import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

const BLOCK_H = 28;
const BASE_W = 200;
const SPEED_BASE = 220;

interface Block {
  x: number;
  w: number;
  color: string;
  y: number;
}

const PALETTE = ['#5b8cff', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22'];

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class StackTower {
  state: GameState = 'menu';
  score = 0;
  best = 0;
  perfectStreak = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private stack: Block[] = [];
  private mover: Block | null = null;
  private moverDir = 1;
  private moverSpeed = SPEED_BASE;
  private camY = 0;
  private flash = 0;
  private perfectFlash = 0;

  start(): void {
    this.score = 0;
    this.perfectStreak = 0;
    this.camY = 0;
    this.moverSpeed = SPEED_BASE;
    this.stack = [{
      x: W / 2 - BASE_W / 2,
      w: BASE_W,
      color: '#4a5568',
      y: H - 80,
    }];
    this.spawnMover();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (a === 'tap' && this.state === 'playing') this.drop();
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  private spawnMover(): void {
    const top = this.stack[this.stack.length - 1];
    const w = top.w;
    this.mover = {
      x: 0,
      w,
      color: PALETTE[this.score % PALETTE.length],
      y: top.y - BLOCK_H - 4,
    };
    this.moverDir = 1;
    this.moverSpeed = SPEED_BASE + this.score * 8;
  }

  private drop(): void {
    const mover = this.mover;
    const top = this.stack[this.stack.length - 1];
    if (!mover) return;

    const left = Math.max(mover.x, top.x);
    const right = Math.min(mover.x + mover.w, top.x + top.w);
    const overlap = right - left;

    if (overlap <= 4) {
      sfx.crash();
      this.flash = 0.4;
      this.setState('over');
      this.onGameOver(this.score, this.score > this.best);
      return;
    }

    const perfect = Math.abs(mover.x - top.x) < 6 && Math.abs(mover.w - top.w) < 4;
    if (perfect) {
      this.perfectStreak++;
      this.perfectFlash = 0.35;
      sfx.coin();
    } else {
      this.perfectStreak = 0;
      sfx.click();
    }

    this.stack.push({
      x: left,
      w: overlap,
      color: mover.color,
      y: mover.y,
    });
    this.score += 1 + (perfect ? 2 : 0) + Math.min(this.perfectStreak, 5);
    this.mover = null;

    const targetCam = Math.max(0, (H - 80) - this.stack[this.stack.length - 1].y - 120);
    this.camY += (targetCam - this.camY) * 0.35;

    if (this.score >= 40) {
      this.setState('over');
      sfx.coin();
      this.onGameOver(this.score, this.score > this.best);
      return;
    }
    this.spawnMover();
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    const mover = this.mover;
    if (!mover) return;
    mover.x += this.moverDir * this.moverSpeed * dt;
    const maxX = W - mover.w - 20;
    if (mover.x >= maxX) { mover.x = maxX; this.moverDir = -1; }
    if (mover.x <= 20) { mover.x = 20; this.moverDir = 1; }
    if (this.flash > 0) this.flash -= dt;
    if (this.perfectFlash > 0) this.perfectFlash -= dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#1a2235';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(0, this.camY);

    for (const b of this.stack) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, BLOCK_H);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(b.x, b.y, b.w, 6);
    }

    const mover = this.mover;
    if (mover && this.state === 'playing') {
      ctx.fillStyle = mover.color;
      ctx.fillRect(mover.x, mover.y, mover.w, BLOCK_H);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(mover.x + 1, mover.y + 1, mover.w - 2, BLOCK_H - 2);
    }

    ctx.restore();

    if (this.perfectFlash > 0) {
      ctx.fillStyle = `rgba(46,204,113,${this.perfectFlash})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(231,76,60,${this.flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 18px system-ui,sans-serif';
    ctx.textAlign = 'center';
    if (this.state === 'playing') ctx.fillText('Tap to stack', W / 2, H - 24);
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}
