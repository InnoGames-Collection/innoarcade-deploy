import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';

export const W = 480;
export const H = 720;

const LANES = [W * 0.25, W * 0.5, W * 0.75];
const LANE_W = 70;

interface Obstacle {
  lane: number;
  y: number;
  speed: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class RaceCar {
  state: GameState = 'menu';
  score = 0;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private lane = 1;
  private laneT = 1;
  private carY = H - 140;
  private obstacles: Obstacle[] = [];
  private rnd = mulberry32(9);
  private dist = 0;
  private spawnT = 0;

  start(): void {
    this.score = 0;
    this.dist = 0;
    this.lane = 1;
    this.laneT = 1;
    this.obstacles = [];
    this.spawnT = 0;
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (a === 'left' && this.lane > 0) { this.lane--; sfx.click(); }
    else if (a === 'right' && this.lane < 2) { this.lane++; sfx.click(); }
    else if (a === 'tap' && this.state === 'playing') {
      // tap left/right half
    }
    else if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  tapSide(left: boolean): void {
    if (this.state !== 'playing') return;
    if (left && this.lane > 0) { this.lane--; sfx.click(); }
    else if (!left && this.lane < 2) { this.lane++; sfx.click(); }
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.laneT += (this.lane - this.laneT) * Math.min(1, dt * 12);
    const speed = 280 + this.dist * 0.05;
    this.dist += speed * dt;
    this.score = Math.floor(this.dist / 12);

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.obstacles.push({
        lane: Math.floor(this.rnd() * 3),
        y: -80,
        speed: speed * (0.9 + this.rnd() * 0.3),
      });
      this.spawnT = 0.7 + this.rnd() * 0.8;
    }

    for (const o of this.obstacles) o.y += o.speed * dt;
    this.obstacles = this.obstacles.filter((o) => o.y < H + 80);

    const laneIdx = Math.round(this.laneT);
    for (const o of this.obstacles) {
      if (o.lane === laneIdx && Math.abs(o.y - this.carY) < 50) this.gameOver();
    }
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
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 1 ? '#636e72' : '#4a5568';
      ctx.fillRect(LANES[i] - LANE_W / 2, 0, LANE_W, H);
    }
    ctx.strokeStyle = '#fdcb6e';
    ctx.setLineDash([20, 20]);
    ctx.lineWidth = 4;
    for (const lx of LANES) {
      ctx.beginPath();
      ctx.moveTo(lx, (this.dist * 0.5) % 40 - 40);
      ctx.lineTo(lx, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const o of this.obstacles) {
      const x = LANES[o.lane];
      ctx.fillStyle = '#e17055';
      ctx.fillRect(x - 24, o.y - 30, 48, 60);
    }

    const cx = LANES[0] + (LANES[2] - LANES[0]) * (this.laneT / 2);
    ctx.fillStyle = '#0984e3';
    ctx.fillRect(cx - 24, this.carY - 30, 48, 60);
    ctx.fillStyle = '#74b9ff';
    ctx.fillRect(cx - 18, this.carY - 22, 36, 20);
  }
}
