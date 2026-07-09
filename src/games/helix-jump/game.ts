import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import { Juice } from '../../engine/juice';
import { drawGemArcStroke, drawGemCircle } from '../_shared/premiumCanvas';

export const W = 480;
export const H = 720;
const CX = W / 2;
const RING_R = 140;
const BALL_R = 12;
const GAP = 1.1;

interface Ring {
  y: number;
  gapStart: number;
  danger: boolean;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class HelixJump {
  state: GameState = 'menu';
  score = 0;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private ballY = 120;
  private ballVy = 0;
  private towerAngle = 0;
  private camY = 0;
  private rings: Ring[] = [];
  private rnd = mulberry32(7);
  private passed = 0;
  private juice = new Juice();
  private smashStreak = 0;
  private clearedRings = new Set<number>();

  start(): void {
    this.score = 0;
    this.passed = 0;
    this.ballY = 120;
    this.ballVy = 0;
    this.towerAngle = 0;
    this.camY = 0;
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.rings = [];
    this.juice = new Juice();
    this.smashStreak = 0;
    this.clearedRings = new Set();
    for (let i = 0; i < 20; i++) this.addRing(200 + i * 90);
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
      this.towerAngle += Math.PI / 3;
      sfx.click();
    }
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  private addRing(y: number): void {
    this.rings.push({
      y,
      gapStart: this.rnd() * Math.PI * 2,
      danger: this.rnd() < 0.22,
    });
  }

  private ballAngle(): number {
    return -Math.PI / 2 - this.towerAngle;
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.juice.update(dt);
    this.ballVy += 680 * dt;
    this.ballY += this.ballVy * dt;

    const targetCam = this.ballY - H * 0.35;
    this.camY += (targetCam - this.camY) * Math.min(1, dt * 5);

    while (this.rings.length && this.rings[0].y < this.camY - 100) {
      this.rings.shift();
      this.passed++;
      this.score = this.passed;
      const last = this.rings[this.rings.length - 1];
      this.addRing(last.y + 90);
    }

    for (const ring of this.rings) {
      const screenY = ring.y - this.camY;
      if (Math.abs(screenY - this.ballY + this.camY) > 30) continue;
      if (this.ballVy <= 0) continue;
      const ang = this.ballAngle();
      let rel = ang - ring.gapStart;
      while (rel < 0) rel += Math.PI * 2;
      while (rel >= Math.PI * 2) rel -= Math.PI * 2;
      const inGap = rel < GAP || rel > Math.PI * 2 - GAP * 0.3;
      if (inGap) {
        if (!this.clearedRings.has(ring.y)) {
          this.clearedRings.add(ring.y);
          this.smashStreak++;
          this.score += Math.min(this.smashStreak, 6);
          this.juice.burst(CX, screenY, '#5b8cff', 6 + this.smashStreak, 100, 3);
          sfx.coin();
        }
      } else {
        this.smashStreak = 0;
        if (ring.danger) {
          sfx.crash();
          this.setState('over');
          this.onGameOver(this.score, this.score > this.best);
          return;
        }
        this.ballVy = -320;
        sfx.coin();
      }
    }

    if (this.ballY > this.camY + H + 80) {
      sfx.crash();
      this.setState('over');
      this.onGameOver(this.score, this.score > this.best);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a2a4a');
    grad.addColorStop(1, '#0d1525');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(CX, 0);

    for (const ring of this.rings) {
      const sy = ring.y - this.camY;
      if (sy < -40 || sy > H + 40) continue;
      ctx.save();
      ctx.translate(0, sy);
      ctx.rotate(this.towerAngle);
      drawGemArcStroke(
        ctx, 0, 0, RING_R,
        ring.gapStart + GAP,
        ring.gapStart + Math.PI * 2 - GAP * 0.3,
        ring.danger ? '#e74c3c' : '#5b8cff',
        22,
      );
      ctx.restore();
    }

    const by = this.ballY - this.camY;
    drawGemCircle(ctx, 0, by, BALL_R, '#ffffff');
    ctx.fillStyle = 'rgba(91,140,255,0.35)';
    ctx.beginPath();
    ctx.arc(0, by, BALL_R + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    this.juice.drawParticles(ctx);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 15px system-ui,sans-serif';
    ctx.textAlign = 'center';
    if (this.state === 'playing') {
      ctx.fillText('Tap to rotate tower', CX, H - 22);
      if (this.smashStreak > 1) {
        ctx.fillStyle = '#5b8cff';
        ctx.fillText(`Smash x${this.smashStreak}`, CX, 36);
      }
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}
