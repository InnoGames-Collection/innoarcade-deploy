import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;
const CX = W / 2;
const CY = 280;
const LOG_R = 72;
const KNIFE_LEN = 90;

interface StuckKnife { angle: number; }

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class KnifeHit {
  state: GameState = 'menu';
  score = 0;
  stage = 1;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private logAngle = 0;
  private spinSpeed = 1.2;
  private knives: StuckKnife[] = [];
  private flying = false;
  private flyY = H - 40;
  private flyT = 0;
  private knivesThisStage = 0;
  private knivesNeeded = 5;
  private boss = false;

  start(): void {
    this.score = 0;
    this.stage = 1;
    this.logAngle = 0;
    this.knives = [];
    this.flying = false;
    this.knivesThisStage = 0;
    this.knivesNeeded = 5;
    this.boss = false;
    this.spinSpeed = 1.2;
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (a === 'tap' && this.state === 'playing' && !this.flying) this.throwKnife();
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  private throwKnife(): void {
    this.flying = true;
    this.flyY = H - 60;
    this.flyT = 0;
    sfx.click();
  }

  /** Angle on the log (local space) where a new knife sticks at the bottom. */
  private stickLocalAngle(): number {
    return this.normAngle(-Math.PI / 2 - this.logAngle);
  }

  private normAngle(a: number): number {
    let x = a % (Math.PI * 2);
    if (x > Math.PI) x -= Math.PI * 2;
    if (x < -Math.PI) x += Math.PI * 2;
    return x;
  }

  private collide(): boolean {
    const hit = this.stickLocalAngle();
    for (const k of this.knives) {
      let diff = Math.abs(this.normAngle(k.angle) - hit);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 0.22) return true;
    }
    return false;
  }

  private nextStage(): void {
    this.stage++;
    this.knivesThisStage = 0;
    this.knivesNeeded = 4 + Math.min(this.stage, 6);
    this.boss = this.stage % 4 === 0;
    this.spinSpeed = 1.2 + this.stage * 0.15 + (this.boss ? 0.8 : 0);
    this.knives = [];
    this.logAngle = 0;
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.logAngle += this.spinSpeed * dt;

    if (this.flying) {
      this.flyT += dt;
      this.flyY -= 520 * dt;
      if (this.flyY <= CY + LOG_R + 10) {
        this.flying = false;
        if (this.collide()) {
          sfx.crash();
          this.setState('over');
          this.onGameOver(this.score, this.score > this.best);
          return;
        }
        this.knives.push({ angle: this.stickLocalAngle() });
        this.knivesThisStage++;
        this.score += 10 + (this.boss ? 5 : 0);
        sfx.coin();
        if (this.knivesThisStage >= this.knivesNeeded) this.nextStage();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#1a2235';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(this.logAngle);

    ctx.fillStyle = this.boss ? '#8B4513' : '#a0622a';
    ctx.beginPath();
    ctx.arc(0, 0, LOG_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c3418';
    ctx.lineWidth = 4;
    ctx.stroke();

    for (const k of this.knives) {
      ctx.save();
      ctx.rotate(k.angle + Math.PI / 2);
      ctx.fillStyle = '#ccc';
      ctx.fillRect(-4, LOG_R - 4, 8, KNIFE_LEN);
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(0, LOG_R + KNIFE_LEN);
      ctx.lineTo(-8, LOG_R + KNIFE_LEN - 16);
      ctx.lineTo(8, LOG_R + KNIFE_LEN - 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    if (this.flying || this.state === 'playing') {
      const y = this.flying ? this.flyY : H - 60;
      ctx.fillStyle = '#ddd';
      ctx.fillRect(CX - 4, y, 8, KNIFE_LEN);
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.moveTo(CX, y + KNIFE_LEN);
      ctx.lineTo(CX - 10, y + KNIFE_LEN - 18);
      ctx.lineTo(CX + 10, y + KNIFE_LEN - 18);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui,sans-serif';
    ctx.textAlign = 'center';
    if (this.state === 'playing' && !this.flying) ctx.fillText('Tap to throw', CX, H - 20);
    if (this.boss) {
      ctx.fillStyle = '#f39c12';
      ctx.fillText('BOSS', CX, 40);
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}
