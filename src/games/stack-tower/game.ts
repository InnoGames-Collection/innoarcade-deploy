// Stack Tower — one-tap precision stacking. Canvas arcade game.
import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { Juice } from '../../engine/juice';
import { drawGemRect } from '../_shared/premiumCanvas';

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
  private juice = new Juice();

  start(): void {
    this.score = 0;
    this.perfectStreak = 0;
    this.camY = 0;
    this.moverSpeed = SPEED_BASE;
    this.juice = new Juice();
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
      this.juice.shake(0.4);
      this.juice.flashOverlay('rgba(231,76,60,0.5)', 0.45);
      this.setState('over');
      this.onGameOver(this.score, this.score > this.best);
      return;
    }

    const tol = Math.max(2, 6 - Math.floor(this.score / 4));
    const perfect = Math.abs(mover.x - top.x) < tol && Math.abs(mover.w - top.w) < tol + 1;
    if (perfect) {
      this.perfectStreak++;
      this.juice.flashOverlay('rgba(46,204,113,0.35)', 0.35);
      this.juice.burst(W / 2, mover.y + BLOCK_H / 2, '#2ecc71', 8, 120, 3);
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
    this.spawnMover();
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.juice.update(dt);
    const mover = this.mover;
    if (!mover) return;
    mover.x += this.moverDir * this.moverSpeed * dt;
    const maxX = W - mover.w - 20;
    if (mover.x >= maxX) { mover.x = maxX; this.moverDir = -1; }
    if (mover.x <= 20) { mover.x = 20; this.moverDir = 1; }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#1a2235';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    this.juice.applyShake(ctx);
    ctx.translate(0, this.camY);

    for (const b of this.stack) {
      drawGemRect(ctx, b.x, b.y, b.w, BLOCK_H, b.color, 4);
    }

    const mover = this.mover;
    if (mover && this.state === 'playing') {
      drawGemRect(ctx, mover.x, mover.y, mover.w, BLOCK_H, mover.color, 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(mover.x + 1, mover.y + 1, mover.w - 2, BLOCK_H - 2);
    }

    ctx.restore();

    this.juice.drawParticles(ctx);
    this.juice.drawFlash(ctx, W, H);

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
