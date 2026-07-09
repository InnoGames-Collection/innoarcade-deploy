import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { Juice } from '../../engine/juice';
import { drawGemCircle, drawWoodDisc } from '../_shared/premiumCanvas';

export const W = 480;
export const H = 720;
const CX = W / 2;
const CY = 280;
const LOG_R = 72;
const KNIFE_BLADE = 72;
const KNIFE_HANDLE = 26;

/** Draw a knife pointing upward (tip at local origin, blade extends +y). */
function drawKnifeShape(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(-8, -KNIFE_HANDLE, 16, KNIFE_HANDLE);
  ctx.fillStyle = '#3e2723';
  ctx.fillRect(-8, -KNIFE_HANDLE, 16, 5);

  ctx.fillStyle = '#9e9e9e';
  ctx.fillRect(-13, 0, 26, 7);

  const blade = ctx.createLinearGradient(-10, 0, 10, 0);
  blade.addColorStop(0, '#78909c');
  blade.addColorStop(0.45, '#eceff1');
  blade.addColorStop(1, '#546e7a');
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.lineTo(-10, 12);
  ctx.lineTo(-7, KNIFE_BLADE);
  ctx.lineTo(0, KNIFE_BLADE + 8);
  ctx.lineTo(7, KNIFE_BLADE);
  ctx.lineTo(10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#455a64';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, 14);
  ctx.lineTo(-1, KNIFE_BLADE - 4);
  ctx.stroke();
}

interface StuckKnife { angle: number; }
interface Apple { angle: number; }

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
  private juice = new Juice();
  private apples: Apple[] = [];

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
    this.juice = new Juice();
    this.spawnApples();
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

  private angleTaken(angle: number, thresh: number): boolean {
    const a = this.normAngle(angle);
    for (const k of this.knives) {
      let diff = Math.abs(this.normAngle(k.angle) - a);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < thresh) return true;
    }
    for (const ap of this.apples) {
      let diff = Math.abs(this.normAngle(ap.angle) - a);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < thresh) return true;
    }
    return false;
  }

  private spawnApples(): void {
    this.apples = [];
    const count = 1 + (this.stage % 3 === 0 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      let angle = 0;
      for (let t = 0; t < 16; t++) {
        angle = -Math.PI + Math.random() * Math.PI * 2;
        if (!this.angleTaken(angle, 0.28)) break;
      }
      this.apples.push({ angle });
    }
  }

  private hitApple(): boolean {
    const hit = this.stickLocalAngle();
    for (let i = 0; i < this.apples.length; i++) {
      let diff = Math.abs(this.normAngle(this.apples[i].angle) - hit);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 0.24) {
        this.apples.splice(i, 1);
        this.score += 25;
        this.juice.burst(CX, CY + LOG_R * 0.5, '#e74c3c', 14, 160, 4);
        sfx.coin();
        return true;
      }
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
    this.spawnApples();
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.juice.update(dt);
    this.logAngle += this.spinSpeed * dt;

    if (this.flying) {
      this.flyT += dt;
      this.flyY -= 520 * dt;
      if (this.flyY <= CY + LOG_R + KNIFE_BLADE + 14) {
        this.flying = false;
        if (this.collide()) {
          sfx.crash();
          this.juice.shake(0.45);
          this.juice.flashOverlay('rgba(231,76,60,0.55)', 0.5);
          this.setState('over');
          this.onGameOver(this.score, this.score > this.best);
          return;
        }
        this.knives.push({ angle: this.stickLocalAngle() });
        this.knivesThisStage++;
        this.hitApple();
        this.score += 10 + (this.boss ? 5 : 0);
        this.juice.burst(CX, CY + LOG_R, '#eceff1', 10, 140, 3);
        sfx.coin();
        if (this.knivesThisStage >= this.knivesNeeded) this.nextStage();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#1a2235';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    this.juice.applyShake(ctx);
    ctx.translate(CX, CY);
    ctx.rotate(this.logAngle);

    drawWoodDisc(ctx, LOG_R, this.boss);

    for (const k of this.knives) {
      ctx.save();
      ctx.rotate(k.angle);
      ctx.translate(0, LOG_R);
      ctx.rotate(Math.PI / 2);
      drawKnifeShape(ctx);
      ctx.restore();
    }

    for (const ap of this.apples) {
      ctx.save();
      ctx.rotate(ap.angle);
      ctx.translate(0, LOG_R - 10);
      drawGemCircle(ctx, 0, 0, 11, '#e74c3c');
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(-3, -14, 6, 5);
      ctx.restore();
    }
    ctx.restore();

    if (this.flying || this.state === 'playing') {
      const y = this.flying ? this.flyY : H - 60;
      ctx.save();
      ctx.translate(CX, y);
      drawKnifeShape(ctx);
      ctx.restore();
    }

    this.juice.drawParticles(ctx);
    this.juice.drawFlash(ctx, W, H);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui,sans-serif';
    ctx.textAlign = 'center';
    if (this.state === 'playing' && !this.flying) ctx.fillText('Tap to throw · 🍎 = bonus', CX, H - 20);
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
