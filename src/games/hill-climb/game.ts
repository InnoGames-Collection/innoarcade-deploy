import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class HillClimb {
  state: GameState = 'menu';
  score = 0;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private x = 40;
  private vx = 0;
  private gas = false;
  private brake = false;
  private angle = 0;
  private flipT = 0;
  private camX = 0;

  start(): void {
    this.x = 40;
    this.vx = 0;
    this.gas = false;
    this.brake = false;
    this.angle = 0;
    this.flipT = 0;
    this.camX = 0;
    this.score = 0;
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  setGas(on: boolean): void { this.gas = on; }
  setBrake(on: boolean): void { this.brake = on; }

  handleAction(a: Action): void {
    if (a === 'tap') this.gas = true;
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  releaseGas(): void { this.gas = false; }

  private terrainY(x: number): number {
    return 420 + Math.sin(x * 0.01) * 70 + Math.sin(x * 0.025) * 35 + Math.sin(x * 0.004) * 20;
  }

  private terrainSlope(x: number): number {
    const d = 4;
    return Math.atan2(this.terrainY(x + d) - this.terrainY(x - d), d * 2);
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;

    if (this.gas) this.vx += 220 * dt;
    if (this.brake) this.vx -= 280 * dt;
    if (!this.gas && !this.brake) this.vx -= 40 * dt;
    this.vx = Math.max(0, Math.min(this.vx, 340));

    this.x += this.vx * dt;
    this.angle = this.terrainSlope(this.x);
    this.score = Math.floor(this.x / 8);

    if (Math.abs(this.angle) > 1.35) {
      this.flipT += dt;
      if (this.flipT > 1.2) {
        sfx.crash();
        this.setState('over');
        this.onGameOver(this.score, this.score > this.best);
      }
    } else {
      this.flipT = 0;
    }

    const targetCam = this.x - W * 0.35;
    this.camX += (targetCam - this.camX) * Math.min(1, dt * 4);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#87ceeb');
    sky.addColorStop(1, '#e8f4fc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#6ab04c';
    ctx.fillRect(0, 460, W, H - 460);

    ctx.save();
    ctx.translate(-this.camX, 0);
    ctx.beginPath();
    const startX = Math.floor(this.camX / 8) * 8 - 40;
    ctx.moveTo(startX, this.terrainY(startX));
    for (let x = startX; x < this.camX + W + 80; x += 8) {
      ctx.lineTo(x, this.terrainY(x));
    }
    ctx.lineTo(this.camX + W + 80, H + 200);
    ctx.lineTo(startX, H + 200);
    ctx.closePath();
    ctx.fillStyle = '#5a8f3a';
    ctx.fill();
    ctx.strokeStyle = '#4a7a2e';
    ctx.lineWidth = 3;
    ctx.stroke();

    const cy = this.terrainY(this.x);
    ctx.save();
    ctx.translate(this.x, cy - 8);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-28, -18, 56, 22);
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-18, 8, 10, 0, Math.PI * 2);
    ctx.arc(18, 8, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ccc';
    ctx.beginPath();
    ctx.arc(-18, 8, 5, 0, Math.PI * 2);
    ctx.arc(18, 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, H - 72, W, 72);
    ctx.fillStyle = '#4f9e16';
    ctx.fillRect(0, H - 72, W / 2, 72);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(W / 2, H - 72, W / 2, 72);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAS', W / 4, H - 28);
    ctx.fillText('BRAKE', (W * 3) / 4, H - 28);
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}
